use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GeometryType {
    Line { start: Point2D, end: Point2D },
    Circle { center: Point2D, radius: f64 },
    Arc { center: Point2D, radius: f64, start_angle: f64, end_angle: f64 },
    Polyline { vertices: Vec<Point2D>, closed: bool },
    Rectangle { origin: Point2D, width: f64, height: f64, rotation: f64 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Entity {
    pub id: String,
    pub geometry: GeometryType,
    pub layer_id: String,
}

#[wasm_bindgen]
pub struct Kernel {
    entities: Vec<Entity>,
    next_id: u64,
}

#[wasm_bindgen]
impl Kernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Kernel {
        Kernel {
            entities: Vec::new(),
            next_id: 1,
        }
    }

    fn gen_id(&mut self) -> String {
        let id = format!("ent_{}", self.next_id);
        self.next_id += 1;
        id
    }

    pub fn create_line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Line {
                start: Point2D { x: x1, y: y1 },
                end: Point2D { x: x2, y: y2 },
            },
            layer_id: layer_id.to_string(),
        };
        self.entities.push(entity);
        id
    }

    pub fn create_circle(&mut self, cx: f64, cy: f64, radius: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Circle {
                center: Point2D { x: cx, y: cy },
                radius,
            },
            layer_id: layer_id.to_string(),
        };
        self.entities.push(entity);
        id
    }

    pub fn create_rectangle(&mut self, x: f64, y: f64, width: f64, height: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Rectangle {
                origin: Point2D { x, y },
                width,
                height,
                rotation: 0.0,
            },
            layer_id: layer_id.to_string(),
        };
        self.entities.push(entity);
        id
    }

    pub fn get_entities_json(&self) -> String {
        serde_json::to_string(&self.entities).unwrap_or_default()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    pub fn delete_entity(&mut self, id: &str) -> bool {
        let before = self.entities.len();
        self.entities.retain(|e| e.id != id);
        self.entities.len() < before
    }

    pub fn move_entity(&mut self, id: &str, dx: f64, dy: f64) -> bool {
        if let Some(entity) = self.entities.iter_mut().find(|e| e.id == id) {
            match &mut entity.geometry {
                GeometryType::Line { start, end } => {
                    start.x += dx; start.y += dy;
                    end.x += dx; end.y += dy;
                }
                GeometryType::Circle { center, .. } | GeometryType::Arc { center, .. } => {
                    center.x += dx; center.y += dy;
                }
                GeometryType::Polyline { vertices, .. } => {
                    for v in vertices.iter_mut() {
                        v.x += dx; v.y += dy;
                    }
                }
                GeometryType::Rectangle { origin, .. } => {
                    origin.x += dx; origin.y += dy;
                }
            }
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_line() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert_eq!(k.entity_count(), 1);
        assert!(id.starts_with("ent_"));
    }

    #[test]
    fn test_move_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert!(k.move_entity(&id, 5.0, 5.0));
    }

    #[test]
    fn test_delete_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert!(k.delete_entity(&id));
        assert_eq!(k.entity_count(), 0);
    }
}
