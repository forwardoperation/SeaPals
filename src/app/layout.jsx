import "@/styles/globals.css";

export const metadata = {
  title: "SeaPals TCG",
  description: "Ocean-inspired trading card game",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}