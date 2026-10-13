import Link from 'next/link';
import Beams from '@/components/ui/ClientBeams';
import { Component as TrustedDevelopersBadge } from '@/components/ui/avatar-demo';
import { TechStackGroup } from '@/components/ui/avatar-group-demo';
import SparkleButton from '@/components/ui/sparkle-button';

async function getPublicStats(): Promise<{
  userCount: number | null;
  // submissionCount: number | null;
  recentUsers?: { name: string; image: string | null }[];
}> {
  try {
    const apiUrl =
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/stats/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { userCount: null, recentUsers: [] };
    return await res.json();
  } catch {
    return { userCount: null, recentUsers: [] };
  }
}

export async function Hero() {
  const stats = await getPublicStats();

  return (
    <section className="relative flex flex-col items-center text-center pt-24 pb-20 px-6 max-w-[1200px] mx-auto w-full">
      <div className="absolute inset-0 pointer-events-none z-0 w-full h-[800px] overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]">
        <div className="w-full h-full relative opacity-60">
          <Beams
            beamWidth={4}
            beamHeight={40}
            beamNumber={30}
            lightColor="#ffa16c"
            speed={1.5}
            noiseIntensity={2.0}
            scale={0.15}
            rotation={-45}
          />
        </div>
      </div>

      <div className="relative z-10 mb-6">
        <TrustedDevelopersBadge
          initialCount={stats.userCount}
          recentUsers={stats.recentUsers}
          // submissionCount={stats.submissionCount}
        />
      </div>

      <h1 className="relative z-10 text-5xl md:text-[54px] font-bold text-fey-white leading-[1.1] tracking-[-0.08em] max-w-3xl mb-6">
        Ace Full-Stack Interviews.
      </h1>

      <p className="relative z-10 text-fey-graphite text-lg max-w-2xl mb-8 leading-relaxed">
        Practice real interview questions, solve coding challenges in an integrated editor, execute
        solutions securely inside isolated environments, and track your progress through a beautiful
        analytics dashboard.
      </p>

      <div className="relative z-10 mb-10">
        <TechStackGroup />
      </div>
    </section>
  );
}
