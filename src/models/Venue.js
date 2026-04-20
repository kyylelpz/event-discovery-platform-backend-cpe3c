const VenueSchema = new mongoose.Schema({
    venue_name: { type: String, required: true }, 
    description: String,
    location: String,
    google_maps_link: String
});