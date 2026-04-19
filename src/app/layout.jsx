import "../styles/globals.css";
import Header from "@/components/layout/Header";

export const metadata = {
  title: "SeaPals TCG",
  description: "Build your reef. Play with friends.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-sky-50 via-cyan-50 to-white text-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-6 md:px-10">
          
          <Header />

          <div className="mt-8">
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}