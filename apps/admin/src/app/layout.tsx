export const metadata = { title: 'Viral Places API', description: 'Viral Places /api/v1 ve operatör paneli (M2)' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 24 }}>{children}</body>
    </html>
  );
}
