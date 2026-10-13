'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { CommunityTestimonialsProps, User, Testimonial } from './types';
import { useTestimonials } from './useTestimonials';
import AvatarStrip from './AvatarStrip';
import TestimonialCard from './TestimonialCard';
import { mockUsers as defaultMockUsers } from './mockData';

const TESTIMONIAL_TEXTS = [
  'The interactive coding workspace combined with real-time feedback completely changed my interview preparation strategy. Mastered my Javascript loops in days.',
  'Next-level sandbox execution speed! Running Node.js and React challenges with instant test case outputs beats conventional mock platforms by a mile.',
  'I love the clean, dark-mode, developer-focused UI. Extremely responsive with excellent keyboard shortcuts and distraction-free layouts.',
  "The AI feedback is incredibly detailed. It doesn't just check if my code passed; it analyzes time complexity and suggests idiomatic refactoring.",
  'System design questions on here are top-tier. Having structural interactive exercises makes complex distributed concepts easy to digest.',
  'No bloated features. Just pure, high-quality JavaScript and TypeScript puzzles that target actual real-world production scenarios.',
  'Best coding prep platform on the market, period. The Git-like workflow integration and terminal emulation are extremely satisfying.',
  'The streak mechanics actually kept me motivated. I did 30 straight days of challenges and cleared my frontend tech loop with ease.',
  'Outstanding developer experience. The Monaco editor integration is seamless, autocomplete is smart, and the VIM keybindings work perfectly.',
  'Solved the tricky closures and recursion exercises here, and literally got asked the exact same questions in my Amazon phone screen!',
  'This platform bridges the gap between theoretical algorithms and actual full-stack engineering. Highly recommended for senior roles.',
  'The SQL execution environment is so fast. Being able to visualize tables and run joins in a sandbox made studying database questions fun.',
  'Finally, an interview prep tool that respects developer time. Beautiful UI, quick loading times, and high-signal explanations.',
  'The React component rendering challenges are amazing. Testing state updates and hooks visually inside a sandbox is a game changer.',
  'Outstanding curated curriculum. Instead of grinding 500 duplicate questions, I solved 50 core ones here and felt prepared.',
  "I'm amazed by the sandboxed environment security and robustness. I can write complex async code and it runs perfectly in seconds.",
  'The progress analytics dashboard is gorgeous. Seeing my performance metrics split by category helped me target my weak spots.',
  'A masterclass in developer tool design. From keyboard accessibility to neat terminal output, everything feels built by developers, for developers.',
  "The daily challenge notifications kept me on track. It is the first time I've maintained a coding habit for more than two weeks.",
  'Saved me weeks of disorganized search. Everything you need to master modern full-stack developer interviews is right here.',
];

function generateTestimonials(users: User[]): Testimonial[] {
  if (users.length === 0) return [];
  return TESTIMONIAL_TEXTS.map((text, i) => {
    const user = users[i % users.length];
    return {
      id: `dyn-t-${i}`,
      userId: user.id,
      rating: 5,
      message: text,
      approved: true,
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
}

export default function CommunityTestimonials({
  users = [],
  testimonials = [],
}: CommunityTestimonialsProps) {
  const [displayUsers, setDisplayUsers] = React.useState<User[]>([]);
  const [displayTestimonials, setDisplayTestimonials] = React.useState<Testimonial[]>([]);
  const [userCount, setUserCount] = React.useState<number>(0);

  const {
    activeSlides,
    activeIndex,
    activeTestimonial,
    activeUser,
    totalPages,
    goToIndex,
    goToUserId,
    pause,
    resume,
  } = useTestimonials(displayUsers, displayTestimonials);

  // Set of user IDs who have approved testimonials for fast lookup
  const usersWithTestimonials = React.useMemo(() => {
    return new Set(activeSlides.map((slide) => slide.user.id));
  }, [activeSlides]);

  React.useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000';

    // Fetch stats user count and real testimonials simultaneously
    Promise.all([
      fetch(`${apiUrl}/api/stats/public`)
        .then((res) => res.json())
        .catch(() => ({})),
      fetch(`${apiUrl}/api/testimonials/public`)
        .then((res) => res.json())
        .catch(() => ({})),
    ]).then(([statsData, testimonialsData]) => {
      if (typeof statsData.userCount === 'number' && statsData.userCount > 0) {
        setUserCount(statsData.userCount);
      }

      const realTestimonialsList: any[] = testimonialsData.data || [];

      if (realTestimonialsList.length > 0) {
        const users: User[] = realTestimonialsList.map((t: any) => ({
          id: t.userId || t.id,
          name: t.name || t.user?.name || 'Developer',
          username: (t.twitter || t.name || 'dev')
            .replace(/^@/, '')
            .toLowerCase()
            .replace(/\s+/g, '_'),
          avatar: t.user?.image || '',
          role: t.title || 'Software Engineer',
        }));

        const testimonials: Testimonial[] = realTestimonialsList.map((t: any, i: number) => ({
          id: t.id || `t-${i}`,
          userId: t.userId,
          message: t.content,
          rating: t.rating || 5,
          approved: true,
          createdAt: t.createdAt,
        }));

        setDisplayUsers(users);
        setDisplayTestimonials(testimonials);
      } else if (Array.isArray(statsData.recentUsers) && statsData.recentUsers.length > 0) {
        const fallbackUsers: User[] = statsData.recentUsers.map((u: any) => ({
          id: u.id || `real-${u.name}`,
          name: u.name,
          username: u.name.toLowerCase().replace(/\s+/g, '_'),
          avatar: u.image || '',
          role: u.role === 'ADMIN' ? 'Admin Developer' : 'Developer',
        }));

        setDisplayUsers(fallbackUsers);
        setDisplayTestimonials(generateTestimonials(fallbackUsers));
      } else {
        setDisplayUsers(defaultMockUsers);
        setDisplayTestimonials(generateTestimonials(defaultMockUsers));
      }
    });
  }, []);

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col justify-between items-center py-12 px-6 lg:px-8 relative overflow-hidden rounded-[24px] bg-[#09090B] border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
      {/* Background System */}
      {/* 1. Subtle Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.07),transparent_75%)] pointer-events-none" />
      {/* 2. Sleek Grid Texture with Radial Masking */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)] pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Small Green Badge */}
        <span className="text-[10px] tracking-[0.25em] font-black text-[#22C55E] uppercase mb-3">
          Testimonials
        </span>

        {/* Large Heading */}
        <h2 className="text-3.5xl lg:text-4xl font-black tracking-tight text-white leading-none">
          What builders are saying
        </h2>

        {/* Subtitle */}
        <p className="text-zinc-500 text-xs md:text-sm mt-3.5 leading-relaxed">
          Real feedback from Real{' '}
          <span className="font-mono text-[#22C55E] font-semibold">&lt;Developers /&gt;</span> on
          InterviewUndo
        </p>
      </div>

      {/* AVATAR STRIP SECTION */}
      <div className="w-full relative z-10 my-8 flex flex-col items-center">
        {/* Count Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.02] border border-white/5 text-zinc-400 text-[11px] font-medium font-mono mb-2 shadow-inner">
          <Users size={12} className="text-[#22C55E]" />
          <span>{userCount.toLocaleString()} Developers Joined</span>
        </div>

        {/* Avatar Strip */}
        <AvatarStrip
          users={displayUsers}
          activeUserId={activeUser?.id || null}
          usersWithTestimonials={usersWithTestimonials}
          onSelectUser={goToUserId}
        />
      </div>

      {/* TESTIMONIAL CARD SECTION */}
      <div className="w-full relative z-10 flex justify-center">
        {activeTestimonial && activeUser && (
          <TestimonialCard
            testimonial={activeTestimonial}
            user={activeUser}
            activeIndex={activeIndex}
            totalPages={totalPages}
            onSelectPage={goToIndex}
            onMouseEnter={pause}
            onMouseLeave={resume}
          />
        )}
      </div>
    </div>
  );
}
