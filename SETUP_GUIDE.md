# TownHall Setup & Feature Guide

## 🎉 Recent Improvements

Your TownRent application now includes professional property posting features:

### ✨ New Features Implemented

1. **Multi-Step Form Wizard**
   - 6 intuitive steps for property posting
   - Progress indicator showing completion status
   - Step-by-step validation
   - Easy navigation between steps

2. **Real Image Upload with Cloudinary**
   - Upload from device, camera, or URL
   - Multiple images (3-10 photos)
   - 5MB max per image
   - Automatic CDN optimization
   - Main photo designation

3. **Structured Location Entry**
   - Street Address Line 1 (required)
   - Street Address Line 2 (optional)
   - Nearby Landmark (optional)
   - City (required)
   - Location tips and examples provided
   - Fields automatically combined for storage

4. **Extended Property Details**
   - Area (square feet)
   - Floor and total floors
   - Furnishing status (Fully/Semi/Unfurnished)
   - Preferred tenants (Family/Bachelor/Any)
   - Pet-friendly indicator
   - Available from date

5. **Live Preview**
   - See exactly how property will appear
   - Preview modal before submission
   - Quick preview button on every step

6. **Auto-save Draft**
   - Saves every 1 second to localStorage
   - Draft restoration on page reload
   - Clear draft option
   - Never lose your work

7. **Mobile Optimized**
   - Responsive step navigation
   - Touch-friendly controls
   - Camera access on mobile
   - Progressive form layout

---

## 🚀 Quick Start Guide

### 1. Environment Configuration

Copy `.env.example` to `.env` and fill in:

```env
# Supabase (Required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Cloudinary (Required for image uploads)
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

### 2. Supabase Setup

#### A. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- If you already have the properties table, run this migration:
ALTER TABLE properties 
  ADD COLUMN IF NOT EXISTS area INTEGER,
  ADD COLUMN IF NOT EXISTS floor INTEGER,
  ADD COLUMN IF NOT EXISTS total_floors INTEGER,
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS furnishing TEXT CHECK (furnishing IN ('Fully Furnished', 'Semi Furnished', 'Unfurnished')),
  ADD COLUMN IF NOT EXISTS preferred_tenants TEXT CHECK (preferred_tenants IN ('Family', 'Bachelor', 'Any')),
  ADD COLUMN IF NOT EXISTS is_pet_friendly BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIN (to_tsvector('english', location));
CREATE INDEX IF NOT EXISTS idx_properties_coordinates ON properties (latitude, longitude);
```

**OR** if you're starting fresh, run the complete schema from `supabase-schema.sql`.

#### B. Configure Google OAuth

1. Go to Authentication → Providers
2. Enable Google provider
3. Add Client ID and Client Secret from Google Cloud Console
4. Add authorized redirect URLs

### 3. Cloudinary Setup

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Dashboard → Copy **Cloud Name**
3. Settings → Upload → Upload presets
4. Create new preset:
   - Signing mode: **Unsigned**
   - Folder: `townrent` (or your choice)
5. Copy preset name to `.env`

---

## 📋 Form Wizard Steps

### Step 1: Basic Info
- Property title
- BHK type (1/2/3/4)
- Area (sq ft)
- Furnishing status
- Floor details
- Available from date
- Contact number
- Preferred tenants
- Pet-friendly checkbox

### Step 2: Location
- Street Address Line 1 (required)
- Street Address Line 2 (optional for apartment/floor)
- Nearby Landmark (optional but recommended)
- City (required)
- Helpful tips and formatting guidelines

### Step 3: Pricing
- Monthly rent
- Security deposit
- Live pricing preview
- Pricing tips

### Step 4: Photos
- Cloudinary upload widget
- Multiple image support
- Image grid preview
- Main photo indicator
- Remove images option

### Step 5: Amenities
- Detailed description
- Character count (min 20)
- Amenities checklist:
  - Parking, WiFi, AC, Power Backup
  - Water Supply, Gym, Pool, Garden
  - Security, Elevator, Refrigerator

### Step 6: Review
- Complete property preview
- Full details display
- Submit & pay button
- Payment notice (₹199 for 30 days)

---

## 🎯 Usage Tips

### For Best Results

**Images:**
- Upload 3-10 high-quality photos
- First image is the main listing photo
- Show all rooms (living, bedroom, kitchen, bathroom)
- Use good lighting and clean spaces
- Max 5MB per image

**Location:**
- Fill all location fields separately for clarity
- Street 1: Building name and street (e.g., "Sunshine Apartments, MG Road")
- Street 2: Area or sector (e.g., "Koramangala 5th Block")
- Nearby: Popular landmarks (e.g., "Near Phoenix Mall, Behind City Hospital")
- City: Full city name (e.g., "Bangalore", "Mumbai")
- Mention metro/bus stops in nearby field for better visibility
- All fields are combined automatically: "Street 1, Street 2, Nearby, City"

**Description:**
- Minimum 20 characters
- Mention nearby facilities
- Include public transport details
- Add school/hospital proximity
- Highlight unique features

**Pricing:**
- Research similar properties in area
- Deposit typically 1-3 months rent
- Competitive pricing attracts more views
- You can negotiate later

---

## 🔧 Technical Details

### File Structure

```
src/app/
├── components/
│   ├── PropertyPreview.tsx    # Live preview component
│   └── ui/                     # Radix UI components
├── context/
│   └── AppContext.tsx          # Updated with new fields
├── pages/
│   └── AddPropertyPage.tsx     # Complete rewrite with wizard
└── ...
```

### Database Schema Changes

New columns added to `properties` table:
- `area` (INTEGER) - Square footage
- `floor` (INTEGER) - Floor number
- `total_floors` (INTEGER) - Building total floors
- `available_from` (TIMESTAMPTZ) - Availability date
- `furnishing` (TEXT) - Furnishing status
- `preferred_tenants` (TEXT) - Tenant preference
- `is_pet_friendly` (BOOLEAN) - Pet policy
- `latitude` (DOUBLE PRECISION) - GPS coordinate (for future use)
- `longitude` (DOUBLE PRECISION) - GPS coordinate (for future use)

### Type Safety

All new fields are properly typed in:
- `PropertyFormData` interface (AddPropertyPage)
- `Property` interface (AppContext)
- `vite-env.d.ts` (environment variables & Cloudinary types)

---

## 🐛 Troubleshooting

### Images Not Uploading
- Check Cloudinary env vars are correct
- Verify upload preset is **unsigned**
- Check browser console for errors
- Ensure images are under 5MB

### Property Not Submitting
- Verify all required fields are filled
- Check validation errors in each step
- Ensure at least one image is uploaded
- Check browser console for errors
- Verify database migration was run

### Draft Not Loading
- Check browser localStorage is enabled
- Clear localStorage if corrupted: `localStorage.removeItem('propertyDraft')`
- Draft only saves if title/location/description has content

---

## 📱 Mobile Experience

### Camera Upload
- Cloudinary widget supports camera on mobile
- Direct photo capture from device
- Multiple photos in one upload

### Touch Navigation
- Large touch targets for buttons
- Swipe-friendly step navigation
- Mobile-optimized form fields
- Responsive image grid

---

## 🔐 Security Notes

1. **RLS Policies** - Database access is restricted:
   - Users can only edit their own properties
   - Anyone can view active properties
   - Pending properties only visible to owner

2. **API Keys** - Keep secure:
   - Never commit `.env` to version control
   - Use unsigned Cloudinary preset with folder restrictions
   - Restrict Google Maps API key to your domain (production)

3. **Data Validation**:
   - Step-by-step form validation
   - Server-side checks in Supabase RLS
   - TypeScript type safety

---

## 🎨 Customization

### Change Step Flow
Edit `STEPS` array in `AddPropertyPage.tsx`:
```typescript
const STEPS = [
  { id: 1, title: 'Your Title', description: 'Your desc' },
  // Add or modify steps
];
```

### Add New Amenities
Edit `availableAmenities` array:
```typescript
const availableAmenities = [
  'Parking', 'WiFi', 
  'Your New Amenity',  // Add here
];
```

### Modify Validation
Update `validateStep()` function for custom rules.

---

## 📞 Support

For issues:
1. Check browser console for errors
2. Verify all environment variables
3. Check Supabase logs (Dashboard → Logs)
4. Verify database migration was successful
5. Test with simple data first

---

## 🎉 Next Steps

Your property listing system is now production-ready! 

**Suggested Enhancements:**
- Add property search/filters
- Implement map view with Google Maps integration
- Add image drag-and-drop reordering
- Email notifications for new listings
- Property comparison feature
- Saved properties/favorites
- Contact form integration

Happy coding! 🚀
