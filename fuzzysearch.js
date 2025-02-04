const Movies = require('./models/movie');

const getPipeline = (query, filters = []) => {
    return [
        {
            "$search": {
                "index": "moviesIndex",
                "compound": {
                    "should": [
                        {
                            "text": {
                                "query": query,
                                "path": "title",
                                "fuzzy": {
                                    "maxEdits": 2,  // Allow up to 2 spelling mistakes
                                    "prefixLength": 2 // First 2 letters must match
                                }
                            }
                        },
                        {
                            "autocomplete": {
                                "query": query,
                                "path": "title"
                            }
                        }
                    ],
                    "minimumShouldMatch": 1
                }
            }
        },
        {
            "$addFields": {
                "textScore": { "$meta": "searchScore" }
            }
        },
        {
            "$limit": 20  // Increase limit before filtering
        },
        {
            "$facet": {
                "movies": [
                    {
                        "$project": {
                            "_id": 0,
                            "title": 1,
                            "plot": 1,
                            "poster": 1,
                            "year": 1,
                            "imdb": "$imdb.rating",
                            "textScore": 1
                        }
                    },
                    { "$sort": { "textScore": -1, "imdb.rating": -1 } }, // Improved sorting
                    { "$limit": 10 }
                ]
            }
        },
        {
            "$project": {
                "results": "$movies"
            }
        },
        { "$unwind": "$results" },
        { "$replaceRoot": { "newRoot": "$results" } },
        {
            "$project": {
                "textScore": 0  // Remove score in final output
            }
        }
    ];

}

const searchMovies = async (req, res) => {
    try {
        const {
            q: query,
            page = 1,
            limit = 20,
            genre,
            year,
            rating
        } = req.query;

        // Validate pagination parameters
        if (isNaN(parseInt(page)) || page < 1 || isNaN(parseInt(limit)) || limit < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters"
            });
        }

        const skip = (page - 1) * limit;
        const pipeline = getPipeline(query);

        const [output] = await Movies.aggregate(pipeline);

        const results = output.results;
        const totalCount = output.totalCount[0]?.count || 0;
        const totalPages = Math.ceil(totalCount / limit);
        results.map((r) => {
            console.log(r.title);

        })
        res.json({
            success: true,
            data: {
                movies: results,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalResults: totalCount,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error performing search',
            error: error.message
        });
    }
};

const autocomplete = async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Query parameter required"
            });
        }
        console.log('Query:', query);



        // if (query) {
        //     pipeline.push({
        //         $match: {
        //             $or: [
        //                 { title: { $regex: query, $options: 'i' } },
        //                 { cast: { $regex: query, $options: 'i' } },
        //                 { directors: { $regex: query, $options: 'i' } }
        //             ]
        //         }
        //     });
        // }

        const pipeline = getPipeline(query)
        const results = await Movies.aggregate(pipeline);
        results.forEach(r => console.log(r.title))

        res.json({
            success: true,
            data: {
                suggestions: results.map(r => ({
                    id: r._id,
                    title: `${r.title} (${r.year})`
                })),
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error performing search',
            error: error.message
        });
    }
};

module.exports = { searchMovies, autocomplete };