This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Features

### Apartment Display with Reviews

The application displays apartments on a map, with zoom functionality to see details. When you click on an apartment marker, you can see:

- The apartment name
- Address information
- Average rating from reviews (if available)
- Number of reviews

### Offline Caching with IndexedDB

Data from Supabase is now cached in the browser's IndexedDB storage, providing these benefits:

- **Improved Performance**: Loads instantly from cache when available
- **Offline Support**: View apartments and reviews even without internet connection
- **Reduced API Calls**: Less strain on the Supabase backend
- **Background Updates**: Fresh data is fetched in the background while showing cached data

The cache control bar at the top of the map shows:

- Whether you're viewing cached or live data
- When the data was last updated
- Buttons to manually refresh data or clear the cache

Cache duration is set to 60 minutes by default.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
