# Setting Up Your Supabase Map with Apartment Annotations

This guide explains how to set up your Supabase database for displaying apartment annotations on your MapKit JS map.

## Prerequisites

- A Supabase project (create one at https://supabase.com if you don't have one)
- Access to your Supabase project credentials
- Node.js and npm installed

## Step 1: Set Up Your Database Schema

1. Go to your Supabase dashboard.
2. Navigate to the SQL Editor.
3. Copy the entire contents of `scripts/create-places-table.sql` and paste it into the SQL editor.
4. Run the script to create the necessary tables and extensions.

**Note:** This will create tables named `places` and `reviews`. If you need to use other names (like `Place` and `Review`), modify the SQL script before running it.

## Step 2: Check Your Database Schema

You can check if your schema is properly set up with:

```bash
cd scripts
npm install @supabase/supabase-js dotenv
node check-supabase-schema.js
```

This will verify that your tables exist and are properly configured. It will check for various table names including `Place`, `place`, `places`, `Review`, `review`, and `reviews`.

## Step 3: Import Sample Data

You can import sample data for testing:

1. Create or update your `.env` file in the `scripts` directory:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

2. Install dependencies and run the import script:

```bash
cd scripts
npm install
node import-sample-data.js
```

## Step 4: Add Sample Reviews (Optional)

If you want to test the review functionality:

```bash
cd scripts
node add-sample-reviews.js
```

This script will:

1. Detect your existing place and review tables
2. Create a review table if it doesn't exist
3. Generate random ratings for each place
4. Display the average rating in the map callouts

## Step 5: Configure Your Frontend

1. Add your Supabase credentials to `.env.local` in your project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. Start your Next.js application:

```bash
npm run dev
```

3. Navigate to the map page and enable the "Show Apartments" toggle.

## How It Works

The map will display apartment markers when:

1. You're connected to Supabase and have places in your database
2. The user zooms in to at least level 13 (configurable)
3. The "Show Apartments" option is enabled

## Adding Your Own Apartment Data

You can add your apartment data to the `places` (or `Place`) table with the following fields:

- `id`: Automatically generated UUID
- `name`: The name of the apartment
- `location`: A PostGIS Point (either as GeoJSON or POINT format)
- `google`: JSON data containing address and other details
- `website`: Website URL
- `phone`: Contact phone number

## Reviews Feature

The map now supports displaying review information in apartment callouts. When a user clicks on an apartment marker, they'll see:

- The average rating (if reviews exist)
- The number of reviews

## Troubleshooting

If markers are not appearing on the map, you can try these steps:

1. **Zoom Level**: Ensure you've zoomed in to at least level 10 on the map (the map now shows a zoom level indicator in the console).

2. **Run the Quick Diagnostic Tool**: We've created a special diagnostic tool to check your Supabase connection and inspect your Place table data:

   ```
   cd scripts
   npm run quick-test
   ```

   This will check for the following:

   - Supabase connection using your environment variables
   - Existence of the Place table
   - Sample records from the Place table
   - Location data format and ability to parse it

   The tool will provide recommendations based on its findings.

3. **Check Console Logs**: Open your browser's developer console to see detailed logs about:

   - Current zoom level
   - Connection attempts to Supabase
   - Number of places fetched
   - Location data parsing results

4. **Check Location Data Format**: The component expects location data in one of these formats:

   - PostGIS `POINT(-122.4194 37.7749)` string format
   - GeoJSON object: `{"type":"Point","coordinates":[-122.4194,37.7749]}`
   - Stringified GeoJSON

5. **Permissions**: Ensure your Supabase policies allow reading from the Place table.

### No markers appearing?

1. Check browser console for errors
2. Verify Supabase connection (credentials in `.env.local`)
3. Confirm you have data in your `places` table
4. Make sure you're zoomed in enough (at least level 13 by default)
5. Verify "Show Apartments" is enabled

### Errors with location data?

If you're getting errors with location data, ensure you're using either:

- GeoJSON format: `{"type":"Point","coordinates":[-122.3679921,37.8243381]}`
- Or POINT format: `POINT(-122.3679921 37.8243381)`

### Table name issues?

The component now checks for multiple table names:

- Places tables: `Place`, `place`, `places`
- Reviews tables: `Review`, `review`, `reviews`

Use the `check-supabase-schema.js` script to verify your table setup.

## Customization

You can customize the map annotations by editing:

- `minZoomForAnnotations` in `MapKit.tsx` (default: 13)
- Marker color (default: `#4B56D2`)
- Icon/glyph (default: `🏢`)
