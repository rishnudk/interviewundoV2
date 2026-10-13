import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://interviewundo.com';
  const backendUrl =
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/problems`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ];

  let dynamicRoutes: any[] = [];
  try {
    const res = await fetch(`${backendUrl}/api/problems?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const result = (await res.json()) as {
        data: Array<{ slug: string }>;
      };
      const problems = result.data || [];
      dynamicRoutes = problems.map((prob) => ({
        url: `${baseUrl}/problems/${prob.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (err) {
    console.warn('Sitemap dynamic routes fetch failed:', err);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
