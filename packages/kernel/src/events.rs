use crate::entity::{Entity, GeometryType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CadEvent {
    EntityCreated { entity: Entity },
    EntityDeleted { entity: Entity },
    EntityMoved { id: String, dx: f64, dy: f64, old_geometry: GeometryType },
    EntityRotated { id: String, cx: f64, cy: f64, angle: f64, old_geometry: GeometryType },
    EntityScaled { id: String, cx: f64, cy: f64, factor: f64, old_geometry: GeometryType },
    EntityCopied { original_id: String, new_entity: Entity },
}

pub struct EventStore {
    events: Vec<CadEvent>,
    cursor: usize,
}

impl EventStore {
    pub fn new() -> Self {
        EventStore {
            events: Vec::new(),
            cursor: 0,
        }
    }

    pub fn push(&mut self, event: CadEvent) {
        self.events.truncate(self.cursor);
        self.events.push(event);
        self.cursor = self.events.len();
    }

    pub fn can_undo(&self) -> bool {
        self.cursor > 0
    }

    pub fn can_redo(&self) -> bool {
        self.cursor < self.events.len()
    }

    pub fn undo(&mut self) -> Option<&CadEvent> {
        if self.cursor > 0 {
            self.cursor -= 1;
            Some(&self.events[self.cursor])
        } else {
            None
        }
    }

    pub fn redo(&mut self) -> Option<&CadEvent> {
        if self.cursor < self.events.len() {
            let event = &self.events[self.cursor];
            self.cursor += 1;
            Some(event)
        } else {
            None
        }
    }

    pub fn event_count(&self) -> usize {
        self.events.len()
    }

    pub fn undo_depth(&self) -> usize {
        self.cursor
    }
}
