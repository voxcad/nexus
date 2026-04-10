use crate::entity::{Point2D, Entity, GeometryType};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ConstraintType {
    /// Fix a point in place
    Fixed { entity_id: String, point_index: usize, position: Point2D },
    /// Two points must coincide
    Coincident { entity_a: String, point_a: usize, entity_b: String, point_b: usize },
    /// Line must be horizontal (dy = 0)
    Horizontal { entity_id: String },
    /// Line must be vertical (dx = 0)
    Vertical { entity_id: String },
    /// Fixed distance between two points
    Distance { entity_a: String, point_a: usize, entity_b: String, point_b: usize, distance: f64 },
    /// Two lines must be parallel
    Parallel { entity_a: String, entity_b: String },
    /// Two lines must be perpendicular
    Perpendicular { entity_a: String, entity_b: String },
    /// Two segments must have equal length
    EqualLength { entity_a: String, entity_b: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Constraint {
    pub id: String,
    pub constraint_type: ConstraintType,
}

pub struct ConstraintSolver {
    constraints: Vec<Constraint>,
    next_id: u64,
    max_iterations: usize,
    tolerance: f64,
}

impl ConstraintSolver {
    pub fn new() -> Self {
        ConstraintSolver {
            constraints: Vec::new(),
            next_id: 1,
            max_iterations: 50,
            tolerance: 0.001,
        }
    }

    pub fn add_constraint(&mut self, constraint_type: ConstraintType) -> String {
        let id = format!("con_{}", self.next_id);
        self.next_id += 1;
        self.constraints.push(Constraint {
            id: id.clone(),
            constraint_type,
        });
        id
    }

    pub fn remove_constraint(&mut self, id: &str) -> bool {
        let before = self.constraints.len();
        self.constraints.retain(|c| c.id != id);
        self.constraints.len() < before
    }

    pub fn get_constraints_json(&self) -> String {
        serde_json::to_string(&self.constraints).unwrap_or_default()
    }

    pub fn constraint_count(&self) -> usize {
        self.constraints.len()
    }

    fn get_point(entity: &Entity, index: usize) -> Option<Point2D> {
        match &entity.geometry {
            GeometryType::Line { start, end } => match index {
                0 => Some(start.clone()),
                1 => Some(end.clone()),
                _ => None,
            },
            GeometryType::Circle { center, .. } => match index {
                0 => Some(center.clone()),
                _ => None,
            },
            GeometryType::Arc { center, .. } => match index {
                0 => Some(center.clone()),
                _ => None,
            },
            GeometryType::Rectangle { origin, width, height, .. } => match index {
                0 => Some(origin.clone()),
                1 => Some(Point2D::new(origin.x + width, origin.y)),
                2 => Some(Point2D::new(origin.x + width, origin.y + height)),
                3 => Some(Point2D::new(origin.x, origin.y + height)),
                _ => None,
            },
            GeometryType::Polyline { vertices, .. } => vertices.get(index).cloned(),
        }
    }

    fn set_point(entity: &mut Entity, index: usize, point: &Point2D) {
        match &mut entity.geometry {
            GeometryType::Line { start, end } => match index {
                0 => { start.x = point.x; start.y = point.y; },
                1 => { end.x = point.x; end.y = point.y; },
                _ => {},
            },
            GeometryType::Circle { center, .. } | GeometryType::Arc { center, .. } => {
                if index == 0 { center.x = point.x; center.y = point.y; }
            },
            GeometryType::Rectangle { origin, .. } => {
                if index == 0 { origin.x = point.x; origin.y = point.y; }
            },
            GeometryType::Polyline { vertices, .. } => {
                if let Some(v) = vertices.get_mut(index) {
                    v.x = point.x;
                    v.y = point.y;
                }
            },
        }
    }

    fn line_length(entity: &Entity) -> Option<f64> {
        if let GeometryType::Line { start, end } = &entity.geometry {
            Some(start.distance_to(end))
        } else {
            None
        }
    }

    /// Solve all constraints iteratively. Returns true if converged.
    pub fn solve(&self, entities: &mut Vec<Entity>) -> bool {
        for _iter in 0..self.max_iterations {
            let mut max_error = 0.0f64;

            for constraint in &self.constraints {
                let error = self.apply_constraint(&constraint.constraint_type, entities);
                max_error = max_error.max(error);
            }

            if max_error < self.tolerance {
                return true;
            }
        }
        false
    }

    fn apply_constraint(&self, ct: &ConstraintType, entities: &mut Vec<Entity>) -> f64 {
        match ct {
            ConstraintType::Fixed { entity_id, point_index, position } => {
                if let Some(entity) = entities.iter_mut().find(|e| e.id == *entity_id) {
                    if let Some(current) = Self::get_point(entity, *point_index) {
                        let error = current.distance_to(position);
                        Self::set_point(entity, *point_index, position);
                        return error;
                    }
                }
                0.0
            }

            ConstraintType::Coincident { entity_a, point_a, entity_b, point_b } => {
                let pa = entities.iter().find(|e| e.id == *entity_a)
                    .and_then(|e| Self::get_point(e, *point_a));
                let pb = entities.iter().find(|e| e.id == *entity_b)
                    .and_then(|e| Self::get_point(e, *point_b));

                if let (Some(pa), Some(pb)) = (pa, pb) {
                    let mid = Point2D::new((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0);
                    let error = pa.distance_to(&pb);

                    if let Some(ea) = entities.iter_mut().find(|e| e.id == *entity_a) {
                        Self::set_point(ea, *point_a, &mid);
                    }
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == *entity_b) {
                        Self::set_point(eb, *point_b, &mid);
                    }
                    return error;
                }
                0.0
            }

            ConstraintType::Horizontal { entity_id } => {
                if let Some(entity) = entities.iter_mut().find(|e| e.id == *entity_id) {
                    if let GeometryType::Line { start, end } = &mut entity.geometry {
                        let mid_y = (start.y + end.y) / 2.0;
                        let error = (start.y - end.y).abs();
                        start.y = mid_y;
                        end.y = mid_y;
                        return error;
                    }
                }
                0.0
            }

            ConstraintType::Vertical { entity_id } => {
                if let Some(entity) = entities.iter_mut().find(|e| e.id == *entity_id) {
                    if let GeometryType::Line { start, end } = &mut entity.geometry {
                        let mid_x = (start.x + end.x) / 2.0;
                        let error = (start.x - end.x).abs();
                        start.x = mid_x;
                        end.x = mid_x;
                        return error;
                    }
                }
                0.0
            }

            ConstraintType::Distance { entity_a, point_a, entity_b, point_b, distance } => {
                let pa = entities.iter().find(|e| e.id == *entity_a)
                    .and_then(|e| Self::get_point(e, *point_a));
                let pb = entities.iter().find(|e| e.id == *entity_b)
                    .and_then(|e| Self::get_point(e, *point_b));

                if let (Some(pa), Some(pb)) = (pa, pb) {
                    let current_dist = pa.distance_to(&pb);
                    if current_dist < 1e-10 { return 0.0; }
                    let error = (current_dist - distance).abs();
                    let factor = distance / current_dist;
                    let mid = Point2D::new((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0);
                    let new_a = Point2D::new(
                        mid.x + (pa.x - mid.x) * factor,
                        mid.y + (pa.y - mid.y) * factor,
                    );
                    let new_b = Point2D::new(
                        mid.x + (pb.x - mid.x) * factor,
                        mid.y + (pb.y - mid.y) * factor,
                    );

                    if let Some(ea) = entities.iter_mut().find(|e| e.id == *entity_a) {
                        Self::set_point(ea, *point_a, &new_a);
                    }
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == *entity_b) {
                        Self::set_point(eb, *point_b, &new_b);
                    }
                    return error;
                }
                0.0
            }

            ConstraintType::Parallel { entity_a, entity_b } => {
                let line_a = entities.iter().find(|e| e.id == *entity_a)
                    .and_then(|e| if let GeometryType::Line { start, end } = &e.geometry {
                        Some((start.clone(), end.clone()))
                    } else { None });
                let line_b_id = entity_b.clone();

                if let Some((sa, ea)) = line_a {
                    let dir_a_x = ea.x - sa.x;
                    let dir_a_y = ea.y - sa.y;
                    let len_a = (dir_a_x * dir_a_x + dir_a_y * dir_a_y).sqrt();
                    if len_a < 1e-10 { return 0.0; }
                    let nx = dir_a_x / len_a;
                    let ny = dir_a_y / len_a;

                    if let Some(eb) = entities.iter_mut().find(|e| e.id == line_b_id) {
                        if let GeometryType::Line { start: sb, end: eb_end } = &mut eb.geometry {
                            let dir_b_x = eb_end.x - sb.x;
                            let dir_b_y = eb_end.y - sb.y;
                            let len_b = (dir_b_x * dir_b_x + dir_b_y * dir_b_y).sqrt();
                            let dot = dir_b_x * nx + dir_b_y * ny;
                            let sign = if dot >= 0.0 { 1.0 } else { -1.0 };
                            let new_end_x = sb.x + sign * nx * len_b;
                            let new_end_y = sb.y + sign * ny * len_b;
                            let error = ((eb_end.x - new_end_x).powi(2) + (eb_end.y - new_end_y).powi(2)).sqrt();
                            eb_end.x = new_end_x;
                            eb_end.y = new_end_y;
                            return error;
                        }
                    }
                }
                0.0
            }

            ConstraintType::Perpendicular { entity_a, entity_b } => {
                let line_a = entities.iter().find(|e| e.id == *entity_a)
                    .and_then(|e| if let GeometryType::Line { start, end } = &e.geometry {
                        Some((start.clone(), end.clone()))
                    } else { None });
                let line_b_id = entity_b.clone();

                if let Some((sa, ea)) = line_a {
                    let dir_a_x = ea.x - sa.x;
                    let dir_a_y = ea.y - sa.y;
                    let len_a = (dir_a_x * dir_a_x + dir_a_y * dir_a_y).sqrt();
                    if len_a < 1e-10 { return 0.0; }
                    let nx = -dir_a_y / len_a;
                    let ny = dir_a_x / len_a;

                    if let Some(eb) = entities.iter_mut().find(|e| e.id == line_b_id) {
                        if let GeometryType::Line { start: sb, end: eb_end } = &mut eb.geometry {
                            let dir_b_x = eb_end.x - sb.x;
                            let dir_b_y = eb_end.y - sb.y;
                            let len_b = (dir_b_x * dir_b_x + dir_b_y * dir_b_y).sqrt();
                            let dot = dir_b_x * nx + dir_b_y * ny;
                            let sign = if dot >= 0.0 { 1.0 } else { -1.0 };
                            let new_end_x = sb.x + sign * nx * len_b;
                            let new_end_y = sb.y + sign * ny * len_b;
                            let error = ((eb_end.x - new_end_x).powi(2) + (eb_end.y - new_end_y).powi(2)).sqrt();
                            eb_end.x = new_end_x;
                            eb_end.y = new_end_y;
                            return error;
                        }
                    }
                }
                0.0
            }

            ConstraintType::EqualLength { entity_a, entity_b } => {
                let len_a = entities.iter().find(|e| e.id == *entity_a)
                    .and_then(|e| Self::line_length(e));
                let len_b_id = entity_b.clone();

                if let Some(la) = len_a {
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == len_b_id) {
                        if let GeometryType::Line { start, end } = &mut eb.geometry {
                            let dx = end.x - start.x;
                            let dy = end.y - start.y;
                            let lb = (dx * dx + dy * dy).sqrt();
                            if lb < 1e-10 { return 0.0; }
                            let error = (lb - la).abs();
                            let factor = la / lb;
                            let mx = (start.x + end.x) / 2.0;
                            let my = (start.y + end.y) / 2.0;
                            start.x = mx - dx * factor / 2.0;
                            start.y = my - dy * factor / 2.0;
                            end.x = mx + dx * factor / 2.0;
                            end.y = my + dy * factor / 2.0;
                            return error;
                        }
                    }
                }
                0.0
            }
        }
    }

    /// Remove all constraints referencing a given entity
    pub fn remove_constraints_for_entity(&mut self, entity_id: &str) {
        self.constraints.retain(|c| {
            match &c.constraint_type {
                ConstraintType::Fixed { entity_id: id, .. } => id != entity_id,
                ConstraintType::Coincident { entity_a, entity_b, .. } => entity_a != entity_id && entity_b != entity_id,
                ConstraintType::Horizontal { entity_id: id } => id != entity_id,
                ConstraintType::Vertical { entity_id: id } => id != entity_id,
                ConstraintType::Distance { entity_a, entity_b, .. } => entity_a != entity_id && entity_b != entity_id,
                ConstraintType::Parallel { entity_a, entity_b } => entity_a != entity_id && entity_b != entity_id,
                ConstraintType::Perpendicular { entity_a, entity_b } => entity_a != entity_id && entity_b != entity_id,
                ConstraintType::EqualLength { entity_a, entity_b } => entity_a != entity_id && entity_b != entity_id,
            }
        });
    }
}
