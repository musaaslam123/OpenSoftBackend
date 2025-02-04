const mongoose = require('mongoose');

const MoviesSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true },
    plot: { type: String },
    fullplot: { type: String },
    type: { type: String, default: 'movie' },
    year: { type: Number },
    runtime: { type: Number },
    poster: { type: String },
    genres: [{ type: String }],
    cast: [{ type: String }],
    directors: [{ type: String }],
    countries: [{ type: String }],
    languages: [{ type: String }],
    rated: { type: String },
    released: { type: Date },
    lastupdated: { type: Date, default: Date.now },

    awards: {
        wins: { type: Number, default: 0 },
        nominations: { type: Number, default: 0 },
        text: { type: String }
    },

    imdb: {
        rating: { type: Number },
        votes: { type: Number },
        id: { type: Number }
    },

    tomatoes: {
        viewer: {
            rating: { type: Number },
            numReviews: { type: Number },
            meter: { type: Number }
        },
        critic: {
            rating: { type: Number },
            numReviews: { type: Number },
            meter: { type: Number }
        },
        fresh: { type: Number },
        rotten: { type: Number },
        lastUpdated: { type: Date }
    },

    num_mflix_comments: { type: Number, default: 0 }
});

// Add text index for search
MoviesSchema.index({
    title: 'text',
    plot: 'text',
    fullplot: 'text'
});

const Movies = mongoose.model('movies', MoviesSchema);

module.exports = Movies;