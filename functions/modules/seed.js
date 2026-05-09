export async function seedMedia(env) {

  // =========================
  // CHECK SI DÉJÀ FAIT
  // =========================
  const check = await env.DB.prepare(`
    SELECT value FROM settings WHERE key = 'seed_done'
  `).first();

  if (check) {
    return new Response(JSON.stringify({
      success: false,
      message: "Seed déjà exécuté"
    }), { status: 403 });
  }

  // =========================
  // DATA (HUMANISÉE)
  // =========================
  const items = [

    {
      url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
      type: "image",
      title: "Nature Glow — énergie naturelle"
    },

    {
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
      type: "image",
      title: "Portrait — jeune femme ambitieuse"
    },

    {
      url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564",
      type: "image",
      title: "L'univers — vision sans limite"
    },

    {
      url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa",
      type: "image",
      title: "Galaxie — expansion digitale"
    },

    {
      url: "https://images.unsplash.com/photo-1556761175-b413da4baf72",
      type: "image",
      title: "Grand salon entrepreneur"
    },

    {
      url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",
      type: "image",
      title: "Academy — formation & leadership"
    },

    {
      url: "https://images.unsplash.com/photo-1518770660439-4636190af475",
      type: "image",
      title: "Innovation digitale"
    },

    {
      url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
      type: "image",
      title: "Focus & détermination"
    }

  ];

  // =========================
  // INSERT DATA
  // =========================
  for (const m of items) {
    await env.DB.prepare(`
      INSERT INTO media (url, type, title)
      VALUES (?, ?, ?)
    `)
    .bind(m.url, m.type, m.title)
    .run();
  }

  // =========================
  // VERROUILLAGE
  // =========================
  await env.DB.prepare(`
    INSERT INTO settings (key, value)
    VALUES ('seed_done', 'true')
  `).run();

  // =========================
  // RESPONSE
  // =========================
  return new Response(JSON.stringify({
    success: true,
    message: "Seed exécuté UNE seule fois",
    inserted: items.length
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
