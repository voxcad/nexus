mod entity;
mod events;

use entity::{Entity, GeometryType, Point2D};
use events::{CadEvent, EventStore};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct Kernel {
    entities: Vec<Entity>,
    event_store: EventStore,
    next_id: u64,
}

#[wasm_bindgen]
impl Kernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Kernel {
        Kernel {
            entities: Vec::new(),
            event_store: EventStore::new(),
            next_id: 1,
        }
    }

    fn gen_id(&mut self) -> String {
        let id = format!("ent_{}", self.next_id);
        self.next_id += 1;
        id
    }

    fn add_entity(&mut self, entity: Entity) -> String {
        let id = entity.id.clone();
        self.event_store
            .push(CadEvent::EntityCreated { entity: entity.clone() });
        self.entities.push(entity);
        id
    }

    // --- Create operations ---

    pub fn create_line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Line {
                start: Point2D::new(x1, y1),
                end: Point2D::new(x2, y2),
            },
            layer_id: layer_id.to_string(),
        };
        self.add_entity(entity)
    }

    pub fn create_circle(&mut self, cx: f64, cy: f64, radius: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Circle {
                center: Point2D::new(cx, cy),
                radius,
            },
            layer_id: layer_id.to_string(),
        };
        self.add_entity(entity)
    }

    pub fn create_arc(
        &mut self,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Arc {
                center: Point2D::new(cx, cy),
                radius,
                start_angle,
                end_angle,
            },
            layer_id: layer_id.to_string(),
        };
        self.add_entity(entity)
    }

    pub fn create_rectangle(
        &mut self,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Rectangle {
                origin: Point2D::new(x, y),
                width,
                height,
                rotation: 0.0,
            },
            layer_id: layer_id.to_string(),
        };
        self.add_entity(entity)
    }

    pub fn create_polyline(&mut self, coords_json: &str, closed: bool, layer_id: &str) -> String {
        let coords: Vec<f64> = serde_json::from_str(coords_json).unwrap_or_default();
        let vertices: Vec<Point2D> = coords
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| Point2D::new(c[0], c[1]))
            .collect();
        let id = self.gen_id();
        let entity = Entity {
            id: id.clone(),
            geometry: GeometryType::Polyline { vertices, closed },
            layer_id: layer_id.to_string(),
        };
        self.add_entity(entity)
    }

    // --- Edit operations ---

    pub fn delete_entity(&mut self, id: &str) -> bool {
        if let Some(pos) = self.entities.iter().position(|e| e.id == id) {
            let entity = self.entities.remove(pos);
            self.event_store
                .push(CadEvent::EntityDeleted { entity });
            true
        } else {
            false
        }
    }

    pub fn move_entity(&mut self, id: &str, dx: f64, dy: f64) -> bool {
        if let Some(entity) = self.entities.iter_mut().find(|e| e.id == id) {
            let old_geometry = entity.geometry.clone();
            entity.geometry.translate(dx, dy);
            self.event_store.push(CadEvent::EntityMoved {
                id: id.to_string(),
                dx,
                dy,
                old_geometry,
            });
            true
        } else {
            false
        }
    }

    pub fn rotate_entity(&mut self, id: &str, cx: f64, cy: f64, angle: f64) -> bool {
        if let Some(entity) = self.entities.iter_mut().find(|e| e.id == id) {
            let old_geometry = entity.geometry.clone();
            entity.geometry.rotate(cx, cy, angle);
            self.event_store.push(CadEvent::EntityRotated {
                id: id.to_string(),
                cx,
                cy,
                angle,
                old_geometry,
            });
            true
        } else {
            false
        }
    }

    pub fn scale_entity(&mut self, id: &str, cx: f64, cy: f64, factor: f64) -> bool {
        if let Some(entity) = self.entities.iter_mut().find(|e| e.id == id) {
            let old_geometry = entity.geometry.clone();
            entity.geometry.scale(cx, cy, factor);
            self.event_store.push(CadEvent::EntityScaled {
                id: id.to_string(),
                cx,
                cy,
                factor,
                old_geometry,
            });
            true
        } else {
            false
        }
    }

    pub fn copy_entity(&mut self, id: &str) -> String {
        if let Some(entity) = self.entities.iter().find(|e| e.id == id).cloned() {
            let new_id = self.gen_id();
            let new_entity = Entity {
                id: new_id.clone(),
                geometry: entity.geometry.clone(),
                layer_id: entity.layer_id.clone(),
            };
            self.event_store.push(CadEvent::EntityCopied {
                original_id: id.to_string(),
                new_entity: new_entity.clone(),
            });
            self.entities.push(new_entity);
            new_id
        } else {
            String::new()
        }
    }

    // --- Undo/Redo ---

    pub fn undo(&mut self) -> bool {
        if let Some(event) = self.event_store.undo().cloned() {
            match event {
                CadEvent::EntityCreated { entity } => {
                    self.entities.retain(|e| e.id != entity.id);
                }
                CadEvent::EntityDeleted { entity } => {
                    self.entities.push(entity);
                }
                CadEvent::EntityMoved {
                    id, old_geometry, ..
                } => {
                    if let Some(e) = self.entities.iter_mut().find(|e| e.id == id) {
                        e.geometry = old_geometry;
                    }
                }
                CadEvent::EntityRotated {
                    id, old_geometry, ..
                } => {
                    if let Some(e) = self.entities.iter_mut().find(|e| e.id == id) {
                        e.geometry = old_geometry;
                    }
                }
                CadEvent::EntityScaled {
                    id, old_geometry, ..
                } => {
                    if let Some(e) = self.entities.iter_mut().find(|e| e.id == id) {
                        e.geometry = old_geometry;
                    }
                }
                CadEvent::EntityCopied { new_entity, .. } => {
                    self.entities.retain(|e| e.id != new_entity.id);
                }
            }
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(event) = self.event_store.redo().cloned() {
            match event {
                CadEvent::EntityCreated { entity } => {
                    self.entities.push(entity);
                }
                CadEvent::EntityDeleted { entity } => {
                    self.entities.retain(|e| e.id != entity.id);
                }
                CadEvent::EntityMoved { id, dx, dy, .. } => {
                    if let Some(e) = self.entities.iter_mut().find(|e| e.id == id) {
                        e.geometry.translate(dx, dy);
                    }
                }
                CadEvent::EntityRotated {
                    id, cx, cy, angle, ..
                } => {
                    if let Some(e) = self.entities.iter_mut().find(|e| e.id == id) {
                        e.geometry.rotate(cx, cy, angle);
                    }
                }
                CadEvent::EntityScaled {
                    id, cx, cy, factor, ..
                } => {
                    if let Some(e) = self.entities.iter_mut().find(|e| e.id == id) {
                        e.geometry.scale(cx, cy, factor);
                    }
                }
                CadEvent::EntityCopied { new_entity, .. } => {
                    self.entities.push(new_entity);
                }
            }
            true
        } else {
            false
        }
    }

    pub fn can_undo(&self) -> bool {
        self.event_store.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.event_store.can_redo()
    }

    pub fn event_count(&self) -> usize {
        self.event_store.event_count()
    }

    // --- Query ---

    pub fn get_entities_json(&self) -> String {
        serde_json::to_string(&self.entities).unwrap_or_default()
    }

    pub fn get_entity_json(&self, id: &str) -> String {
        self.entities
            .iter()
            .find(|e| e.id == id)
            .map(|e| serde_json::to_string(e).unwrap_or_default())
            .unwrap_or_default()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_count() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.create_circle(5.0, 5.0, 3.0, "default");
        k.create_rectangle(0.0, 0.0, 20.0, 10.0, "default");
        assert_eq!(k.entity_count(), 3);
    }

    #[test]
    fn test_undo_create() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert_eq!(k.entity_count(), 1);
        assert!(k.undo());
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn test_redo_create() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.undo();
        assert_eq!(k.entity_count(), 0);
        assert!(k.redo());
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_undo_delete() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.delete_entity(&id);
        assert_eq!(k.entity_count(), 0);
        k.undo();
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_undo_move() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.move_entity(&id, 5.0, 5.0);
        k.undo();
        let json = k.get_entity_json(&id);
        assert!(json.contains("\"x\":0.0"));
    }

    #[test]
    fn test_copy_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        let copy_id = k.copy_entity(&id);
        assert_eq!(k.entity_count(), 2);
        assert_ne!(id, copy_id);
    }

    #[test]
    fn test_undo_branching() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.create_circle(5.0, 5.0, 3.0, "default");
        assert_eq!(k.entity_count(), 2);
        k.undo();
        assert_eq!(k.entity_count(), 1);
        k.create_rectangle(0.0, 0.0, 5.0, 5.0, "default");
        assert_eq!(k.entity_count(), 2);
        assert!(!k.can_redo());
    }

    #[test]
    fn test_rotate_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "default");
        k.rotate_entity(&id, 0.0, 0.0, std::f64::consts::FRAC_PI_2);
        let json = k.get_entity_json(&id);
        // After 90 degree rotation, end point (10,0) -> approx (0,10)
        assert!(json.contains("\"y\":10.0") || json.contains("\"y\":9.99"));
    }

    #[test]
    fn test_scale_entity() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 5.0, "default");
        k.scale_entity(&id, 0.0, 0.0, 2.0);
        let json = k.get_entity_json(&id);
        assert!(json.contains("10.0"));
    }

    #[test]
    fn test_create_arc() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 5.0, 0.0, 1.5707, "default");
        assert_eq!(k.entity_count(), 1);
        let json = k.get_entity_json(&id);
        assert!(json.contains("Arc"));
    }

    // Preserve original tests
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
