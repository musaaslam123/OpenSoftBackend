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
                            "_id": 1,
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

const getSearchPipeline = (query, filters = {}) => {
    const { genre, year, rating, sortBy = 'relevance' } = filters;

    const pipeline = [
        {
            "$search": {
                "index": "moviesIndex",
                "compound": {
                    "must": [],
                    "should": [
                        {
                            "text": {
                                "query": query,
                                "path": ["title", "plot", "actors", "director"],
                                "fuzzy": {
                                    "maxEdits": 2,
                                    "prefixLength": 2
                                },
                                "score": { "boost": { "value": 3 } }
                            }
                        },
                        {
                            "autocomplete": {
                                "query": query,
                                "path": "title",
                                "score": { "boost": { "value": 2 } }
                            }
                        },
                        {
                            "text": {
                                "query": query,
                                "path": ["genres", "keywords"],
                                "score": { "boost": { "value": 1.5 } }
                            }
                        }
                    ],
                    "minimumShouldMatch": 1
                }
            }
        },
        {
            "$addFields": {
                "searchScore": { "$meta": "searchScore" }
            }
        }
    ];

    // Apply filters if provided
    if (genre) {
        pipeline.push({
            "$match": { "genres": genre }
        });
    }

    if (year) {
        pipeline.push({
            "$match": { "year": parseInt(year) }
        });
    }

    if (rating) {
        pipeline.push({
            "$match": { "imdb.rating": { "$gte": parseFloat(rating) } }
        });
    }

    // Add facets for both results and metadata
    pipeline.push({
        "$facet": {
            "movies": [
                {
                    "$project": {
                        "_id": 1,
                        "title": 1,
                        "plot": 1,
                        "poster": 1,
                        "year": 1,
                        "runtime": 1,
                        "genres": 1,
                        "director": 1,
                        "actors": 1,
                        "imdb": 1,
                        "searchScore": 1
                    }
                },
                {
                    "$sort": getSortingCriteria(sortBy)
                }
            ],
            "metadata": [
                {
                    "$group": {
                        "_id": null,
                        "totalCount": { "$sum": 1 },
                        "avgRating": { "$avg": "$imdb.rating" },
                        "genres": { "$addToSet": "$genres" },
                        "years": { "$addToSet": "$year" }
                    }
                }
            ]
        }
    });

    return pipeline;
};

const getSortingCriteria = (sortBy) => {
    const sortingOptions = {
        'relevance': { "searchScore": -1, "imdb.rating": -1 },
        'rating': { "imdb.rating": -1, "searchScore": -1 },
        'year': { "year": -1, "searchScore": -1 },
        'title': { "title": 1, "searchScore": -1 }
    };
    return sortingOptions[sortBy] || sortingOptions['relevance'];
};

const searchMovies = async (req, res) => {
    try {
        const {
            q: query,
            page = 1,
            limit = 20,
            genre,
            year,
            rating,
            sortBy
        } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        // Validate pagination parameters
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);
        if (isNaN(parsedPage) || parsedPage < 1 || isNaN(parsedLimit) || parsedLimit < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters"
            });
        }

        const skip = (parsedPage - 1) * parsedLimit;
        const pipeline = getSearchPipeline(query, { genre, year, rating, sortBy });

        const [result] = await Movies.aggregate(pipeline);

        const movies = result.movies.slice(skip, skip + parsedLimit);
        const metadata = result.metadata[0] || {
            totalCount: 0,
            avgRating: 0,
            genres: [],
            years: []
        };

        const totalPages = Math.ceil(metadata.totalCount / parsedLimit);

        res.json({
            success: true,
            data: {
                movies,
                metadata: {
                    totalCount: metadata.totalCount,
                    avgRating: parseFloat(metadata.avgRating.toFixed(1)),
                    availableFilters: {
                        genres: metadata.genres.flat().filter(Boolean).sort(),
                        years: metadata.years.sort((a, b) => b - a)
                    }
                },
                pagination: {
                    currentPage: parsedPage,
                    totalPages,
                    totalResults: metadata.totalCount,
                    hasNextPage: parsedPage < totalPages,
                    hasPrevPage: parsedPage > 1
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