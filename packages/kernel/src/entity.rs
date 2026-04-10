use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance_to(&self, other: &Point2D) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }

    pub fn translate(&mut self, dx: f64, dy: f64) {
        self.x += dx;
        self.y += dy;
    }

    pub fn rotate_around(&mut self, cx: f64, cy: f64, angle: f64) {
        let cos = angle.cos();
        let sin = angle.sin();
        let dx = self.x - cx;
        let dy = self.y - cy;
        self.x = cx + dx * cos - dy * sin;
        self.y = cy + dx * sin + dy * cos;
    }

    pub fn scale_around(&mut self, cx: f64, cy: f64, factor: f64) {
        self.x = cx + (self.x - cx) * factor;
        self.y = cy + (self.y - cy) * factor;
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GeometryType {
    Line { start: Point2D, end: Point2D },
    Circle { center: Point2D, radius: f64 },
    Arc { center: Point2D, radius: f64, start_angle: f64, end_angle: f64 },
    Polyline { vertices: Vec<Point2D>, closed: bool },
    Rectangle { origin: Point2D, width: f64, height: f64, rotation: f64 },
}

impl GeometryType {
    pub fn translate(&mut self, dx: f64, dy: f64) {
        match self {
            GeometryType::Line { start, end } => {
                start.translate(dx, dy);
                end.translate(dx, dy);
            }
            GeometryType::Circle { center, .. } | GeometryType::Arc { center, .. } => {
                center.translate(dx, dy);
            }
            GeometryType::Polyline { vertices, .. } => {
                for v in vertices.iter_mut() {
                    v.translate(dx, dy);
                }
            }
            GeometryType::Rectangle { origin, .. } => {
                origin.translate(dx, dy);
            }
        }
    }

    pub fn rotate(&mut self, cx: f64, cy: f64, angle: f64) {
        match self {
            GeometryType::Line { start, end } => {
                start.rotate_around(cx, cy, angle);
                end.rotate_around(cx, cy, angle);
            }
            GeometryType::Circle { center, .. } => {
                center.rotate_around(cx, cy, angle);
            }
            GeometryType::Arc { center, start_angle, end_angle, .. } => {
                center.rotate_around(cx, cy, angle);
                *start_angle += angle;
                *end_angle += angle;
            }
            GeometryType::Polyline { vertices, .. } => {
                for v in vertices.iter_mut() {
                    v.rotate_around(cx, cy, angle);
                }
            }
            GeometryType::Rectangle { origin, rotation, width, height } => {
                let ccx = origin.x + *width / 2.0;
                let ccy = origin.y + *height / 2.0;
                let mut center = Point2D::new(ccx, ccy);
                center.rotate_around(cx, cy, angle);
                origin.x = center.x - *width / 2.0;
                origin.y = center.y - *height / 2.0;
                *rotation += angle;
            }
        }
    }

    pub fn scale(&mut self, cx: f64, cy: f64, factor: f64) {
        match self {
            GeometryType::Line { start, end } => {
                start.scale_around(cx, cy, factor);
                end.scale_around(cx, cy, factor);
            }
            GeometryType::Circle { center, radius } => {
                center.scale_around(cx, cy, factor);
                *radius *= factor;
            }
            GeometryType::Arc { center, radius, .. } => {
                center.scale_around(cx, cy, factor);
                *radius *= factor;
            }
            GeometryType::Polyline { vertices, .. } => {
                for v in vertices.iter_mut() {
                    v.scale_around(cx, cy, factor);
                }
            }
            GeometryType::Rectangle { origin, width, height, .. } => {
                origin.scale_around(cx, cy, factor);
                *width *= factor;
                *height *= factor;
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Entity {
    pub id: String,
    pub geometry: GeometryType,
    pub layer_id: String,
}
