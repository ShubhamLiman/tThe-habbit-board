import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
export default function Home() {
  return (
    <div className="bg-white dark:bg-black">
      <Navbar />
      <Hero />
    </div>
  );
}
