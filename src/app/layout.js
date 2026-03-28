import { Oswald } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "700"], // Choose the weights you need
  variable: "--font-oswald", // This creates the CSS variable
});
export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevents unwanted zooming on mobile inputs
};

export const metadata = {
  title: "Command Center",
  description: "Tactical Discipline Matrix",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="scroll-smooth dark"
      data-scroll-behavior="smooth"
    >
      <body
        className={`${oswald.variable} font-sans antialiased bg-white dark:bg-black`}
      >
        {children}
      </body>
    </html>
  );
}
