
  # TownHall

  This is a code bundle for TownHall. The original project is available at https://www.figma.com/design/STsxRden3SavphtWUHt5KX/TownHall.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.  
  
  ## Authentication Setup

  This app uses Google OAuth for authentication via Supabase.

  ### Setup Steps:

  1. **Create a Supabase Project** at [supabase.com](https://supabase.com)

  2. **Configure Google OAuth Provider:**
     - Go to your Supabase Dashboard → Authentication → Providers
     - Enable Google provider
     - Add your Google OAuth credentials (Client ID and Client Secret)
     - Add authorized redirect URLs:
       - For development: `http://localhost:5173/dashboard`
       - For production: `https://yourdomain.com/dashboard`

  3. **Create Google OAuth Credentials:**
     - Go to [Google Cloud Console](https://console.cloud.google.com)
     - Create a new project or select existing one
     - Enable Google+ API
     - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
     - Add authorized redirect URIs from your Supabase project (found in Auth settings)
     - Copy Client ID and Client Secret to Supabase

  4. **Update Environment Variables:**
     - Copy `.env.example` to `.env`
     - Add your Supabase URL and Anon Key from Project Settings → API

  5. **Set Up Database:**
     - Go to Supabase Dashboard → SQL Editor
     - Run the SQL schema from `supabase-schema.sql` file
     - This will create the `properties` table with:
       - Row Level Security (RLS) policies
       - Indexes for performance
       - Automatic timestamp updates
     - Verify table creation in Database → Tables

  ### User Flow:

  - Users sign in with their Google account
  - No password or email verification needed
  - All users can list properties and browse listings
  - Profile information is automatically populated from Google account
  
  ## Cloudinary Setup (Image Upload)

  1. **Create a Cloudinary Account** at [cloudinary.com](https://cloudinary.com)
  
  2. **Get Your Credentials:**
     - Go to Dashboard
     - Copy your **Cloud Name**
  
  3. **Create Upload Preset:**
     - Go to Settings → Upload → Upload presets
     - Click "Add upload preset"
     - Set signing mode to "Unsigned"
     - Configure folder (e.g., `townrent`)
     - Copy the preset name
  
  4. **Add to .env:**
     ```
     VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
     VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
     ```
  
  ## Database Structure

  ### Properties Table Fields:
  - `id` - Unique identifier (UUID)
  - `title` - Property title
  - `rent` - Monthly rent amount
  - `deposit` - Security deposit
  - `bhk` - Property type (1BHK, 2BHK, etc.)
  - `location` - Property location
  - `description` - Detailed description
  - `images` - Array of image URLs
  - `amenities` - Array of amenities
  - `area` - Property area in square feet
  - `floor` - Floor number
  - `total_floors` - Total floors in building
  - `available_from` - Date when property is available
  - `furnishing` - Fully Furnished/Semi Furnished/Unfurnished
  - `preferred_tenants` - Family/Bachelor/Any
  - `is_pet_friendly` - Boolean for pet-friendly properties
  - `latitude` - GPS latitude (optional, for future map features)
  - `longitude` - GPS longitude (optional, for future map features)
  - `owner_id` - User ID (linked to auth.users)
  - `owner_name` - Owner's name
  - `owner_phone` - Owner's phone number
  - `status` - pending/active/expired
  - `payment_status` - pending/paid
  - `created_at` - Creation timestamp
  - `expires_at` - Expiry timestamp (30 days from creation)
  
  ## Features

  ### Property Listing
  - **6-Step Form Wizard** - Guided property posting experience
  - **Real Image Upload** - Cloudinary integration with device/camera/URL upload
  - **Structured Location Entry** - Separate fields for street, landmarks, and city
  - **Live Preview** - See how your property will look before posting
  - **Auto-save Draft** - Never lose your work (saves every second to localStorage)
  - **Mobile Optimized** - Responsive design with touch-friendly controls

  ### Additional Property Details
  - Area in square feet
  - Floor and total floors
  - Furnishing status
  - Preferred tenant type
  - Pet-friendly indicator
  - Available from date
  
