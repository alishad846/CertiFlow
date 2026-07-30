import { pool } from '../db/pool';

async function run() {
  await pool.query(`
    ALTER TABLE certificate_templates
      ADD COLUMN IF NOT EXISTS editor_document jsonb,
      ADD COLUMN IF NOT EXISTS render_engine text NOT NULL DEFAULT 'legacy';
  `);
  await pool.query(`
    ALTER TABLE certificate_templates
      ADD CONSTRAINT certificate_templates_render_engine_chk
      CHECK (render_engine IN ('legacy','editor')) NOT VALID;
  `).catch(() => undefined); // ignore if already present
  console.log('editor_document migration complete');
  await pool.end();
}

run().catch((err) => { console.error(err); process.exit(1); });
