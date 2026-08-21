DO $$
DECLARE m RECORD; mv uuid[] := '{}'; BEGIN
  FOR m IN SELECT pm.* FROM esp_production_note_materials pm JOIN esp_production_notes n ON n.id = pm.note_id WHERE n.title = '2 franelas Engras XL (test)' LOOP
    UPDATE esp_material_stock s SET quantity_on_hand = s.quantity_on_hand + m.total_quantity WHERE s.material_id = m.material_id AND s.location_id = m.location_id;
    IF m.material_movement_id IS NOT NULL THEN mv := mv || m.material_movement_id; END IF;
  END LOOP;
  DELETE FROM esp_production_note_materials WHERE note_id IN (SELECT id FROM esp_production_notes WHERE title = '2 franelas Engras XL (test)');
  DELETE FROM esp_production_notes WHERE title = '2 franelas Engras XL (test)';
  DELETE FROM esp_material_movements WHERE id = ANY(mv);
END $$;