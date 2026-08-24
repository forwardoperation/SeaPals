export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    alternates: {
      canonical: `/tournaments/${encodeURIComponent(String(slug ?? ""))}/enter`,
    },
    robots: { index: false, follow: false },
  };
}

export default function TournamentEntryLayout({ children }) {
  return children;
}
