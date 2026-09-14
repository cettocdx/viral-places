export default function Home() {
  return (
    <main>
      <h1>Viral Places API</h1>
      <p>
        <code>/api/v1</code> — public okuma (map/places, places/:id, creators/:id), kullanıcı kütüphanesi (me/*), imports ve sağlayıcı webhook'u.
        Veri modu: <strong>DEMO</strong> (sentetik fixture). Operatör paneli M4.
      </p>
      <ul>
        <li><a href="/api/v1/health">/api/v1/health</a></li>
        <li><a href="/api/v1/map/places?west=28.9&south=40.95&east=29.1&north=41.1&zoom=12">/api/v1/map/places</a></li>
      </ul>
    </main>
  );
}
