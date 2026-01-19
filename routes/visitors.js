import express from "express";
import Visitor from "../models/visitors.js";
import User from "../models/users.js";
import { checkVisitor } from "../middlewares/verifyemail.middleware.js";
import checkPermission from "../middlewares/checkRole.js";

const VisitorRouter = express.Router();


function getMostVisitedRegion(distribution) {
    const regionMap = {};
    distribution.forEach(item => {
        if (item.region) {
            regionMap[item.region] = (regionMap[item.region] || 0) + item.totalVisits;
        }
    });

    const mostVisited = Object.entries(regionMap).sort((a, b) => b[1] - a[1])[0];
    return mostVisited ? { region: mostVisited[0], visits: mostVisited[1] } : null;
}

VisitorRouter.post("/", async (req, res) => {
    try {
        const { objData } = req.body;

        if (!objData) {
            return res.status(400).json({ status: false, message: "Data is required" });
        }

        const query = {
            country: objData.country,
            city: objData.city,
            countryCode: objData.countryCode,
            latitude: objData.latitude,
            longitude: objData.longitude,
            query: objData.query,
            region: objData.region,
            regionName: objData.regionName,
            flag: objData.flag,
            device: objData.device
        };

        const existingVisitor = await Visitor.findOne(query);

        let update = {
            $inc: { impression: 1 },
            $set: { currentTimeAdded: objData.currentTimeAdded },
            $setOnInsert: { timeAdded: objData.timeAdded }
        };

        if (existingVisitor && existingVisitor.currentTimeAdded) {
            update.$set.lastTimeAdded = existingVisitor.currentTimeAdded;
        }

        const visitor = await Visitor.findOneAndUpdate(query, update, {
            new: true,
            upsert: true
        });

        return res.status(201).json({ status: true, data: visitor._id });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: false, message: "Server error" });
    }
});

VisitorRouter.post("/checkvisitor", checkVisitor, (req, res) => {
    return res.json({ status: true, message: "Visitor is valid." });
});

VisitorRouter.get("/top-country", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        // Aggregate to find country with maximum impressions
        const topCountry = await Visitor.aggregate([
            {
                $group: {
                    _id: "$country",
                    totalVisitors: { $sum: "$impression" },
                    countryCode: { $first: "$countryCode" },
                    regionName: { $first: "$regionName" },
                    region: { $first: "$region" },
                    city: { $first: "$city" },
                    flag: { $first: "$flag" },
                    lastVisit: { $max: "$lastTimeAdded" },
                    firstVisit: { $min: "$timeAdded" },
                    currentVisit: { $max: "$currentTimeAdded" }
                }
            },
            { $sort: { totalVisitors: -1 } },
            { $limit: 1 }
        ]);

        if (topCountry.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No visitor data found"
            });
        }

        // Calculate percentage of total traffic
        const totalAllVisitors = await Visitor.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$impression" }
                }
            }
        ]);

        const totalTraffic = totalAllVisitors[0]?.total || 1;
        const percentage = Math.round((topCountry[0].totalVisitors / totalTraffic) * 100);

        const responseData = {
            country: topCountry[0]._id,
            countryCode: topCountry[0].countryCode,
            region: topCountry[0].region,
            regionName: topCountry[0].regionName,
            city: topCountry[0].city,
            flag: topCountry[0].flag || `https://upload.wikimedia.org/wikipedia/commons/3/32/Flag_of_Pakistan.svg`,
            totalVisitors: topCountry[0].totalVisitors,
            percentage: percentage,
            lastVisit: topCountry[0].lastVisit,
            firstVisit: topCountry[0].firstVisit,
            currentVisit: topCountry[0].currentVisit
        };

        return res.status(200).json({
            status: true,
            data: responseData
        });

    } catch (err) {
        console.error("Error fetching top country:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching top visitor country"
        });
    }
});

VisitorRouter.get("/statistics", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        const totalVisitors = await Visitor.aggregate([
            {
                $group: {
                    _id: null,
                    totalVisits: { $sum: "$impression" },
                    uniqueCountries: { $addToSet: "$country" },
                    totalCountries: { $sum: 1 }
                }
            }
        ]);

        const topCountries = await Visitor.aggregate([
            {
                $group: {
                    _id: "$country",
                    visits: { $sum: "$impression" },
                    countryCode: { $first: "$countryCode" }
                }
            },
            { $sort: { visits: -1 } },
            { $limit: 5 }
        ]);

        const statistics = {
            totalVisits: totalVisitors[0]?.totalVisits || 0,
            uniqueCountries: totalVisitors[0]?.uniqueCountries?.length || 0,
            topCountries: topCountries
        };

        return res.status(200).json({
            status: true,
            data: statistics
        });

    } catch (err) {
        console.error("Error fetching visitor statistics:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching visitor statistics"
        });
    }
});

VisitorRouter.get("/distribution", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        // Aggregate visitors by country with counts - countryCode directly use karein
        const visitorDistribution = await Visitor.aggregate([
            {
                $match: {
                    countryCode: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$countryCode",
                    country: { $first: "$country" },
                    totalVisits: { $sum: "$impression" },
                    region: { $first: "$region" },
                    regionName: { $first: "$regionName" },
                    city: { $first: "$city" },
                    flag: { $first: "$flag" },
                    visitorCount: { $sum: 1 },
                    lastVisit: { $max: "$lastTimeAdded" },
                    firstVisit: { $min: "$timeAdded" }
                }
            },
            {
                $sort: { totalVisits: -1 }
            },
            {
                $project: {
                    id: "$_id",
                    country: 1,
                    totalVisits: 1,
                    countryCode: "$_id",
                    region: 1,
                    regionName: 1,
                    city: 1,
                    flag: 1,
                    visitorCount: 1,
                    lastVisit: 1,
                    firstVisit: 1,
                    _id: 0
                }
            }
        ]);

        // Format data for map - WITHOUT am5 (backend mein am5 nahi use karein)
        const mapData = visitorDistribution.map(item => ({
            id: item.id, // ISO country code
            country: item.country,
            value: item.totalVisits,
            visits: item.totalVisits,
            visitorCount: item.visitorCount,
            region: item.region,
            regionName: item.regionName,
            city: item.city,
            flag: item.flag,
            lastVisit: item.lastVisit,
            firstVisit: item.firstVisit
            // ❌ fill: am5.color(0x3b82f6) - REMOVE THIS LINE
        }));

        return res.status(200).json({
            status: true,
            data: mapData,
            totalCountries: visitorDistribution.length,
            totalVisits: visitorDistribution.reduce((sum, item) => sum + item.totalVisits, 0),
            summary: {
                topCountry: visitorDistribution[0] || null,
                mostVisitedRegion: getMostVisitedRegion(visitorDistribution)
            }
        });

    } catch (err) {
        console.error("Error fetching visitor distribution:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching visitor distribution"
        });
    }
});

VisitorRouter.get("/country/:countryCode", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        const { countryCode } = req.params;

        const countryData = await Visitor.aggregate([
            {
                $match: {
                    countryCode: countryCode.toUpperCase()
                }
            },
            {
                $group: {
                    _id: "$countryCode",
                    country: { $first: "$country" },
                    totalVisits: { $sum: "$impression" },
                    uniqueVisitors: { $sum: 1 },
                    regions: { $addToSet: "$region" },
                    cities: { $addToSet: "$city" },
                    flag: { $first: "$flag" },
                    lastVisit: { $max: "$lastTimeAdded" },
                    firstVisit: { $min: "$timeAdded" },
                    avgImpressions: { $avg: "$impression" }
                }
            }
        ]);

        if (countryData.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Country data not found"
            });
        }

        return res.status(200).json({
            status: true,
            data: countryData[0]
        });

    } catch (err) {
        console.error("Error fetching country data:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching country data"
        });
    }
});

VisitorRouter.get("/pie-data", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        // Aggregate visitors by country for pie chart (top 5-10 countries)
        const visitorsByCountry = await Visitor.aggregate([
            {
                $match: {
                    countryCode: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$countryCode",
                    country: { $first: "$country" },
                    totalVisits: { $sum: "$impression" },
                    visitorCount: { $sum: 1 },
                    flag: { $first: "$flag" },
                    region: { $first: "$region" }
                }
            },
            {
                $sort: { totalVisits: -1 }
            },
            {
                $limit: 8 // Top 8 countries show karein
            },
            {
                $project: {
                    id: "$_id",
                    country: 1,
                    value: "$totalVisits", // Pie chart ke liye value field
                    visits: "$totalVisits",
                    visitorCount: 1,
                    flag: 1,
                    region: 1,
                    _id: 0
                }
            }
        ]);

        // Calculate "Others" category agar countries zyada hain
        const totalAllVisits = await Visitor.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$impression" }
                }
            }
        ]);

        const totalVisits = totalAllVisits[0]?.total || 0;
        const shownVisits = visitorsByCountry.reduce((sum, item) => sum + item.visits, 0);
        const othersVisits = totalVisits - shownVisits;

        // Agar "Others" category significant hai to add karein
        if (othersVisits > 0 && othersVisits > visitorsByCountry[visitorsByCountry.length - 1]?.visits) {
            visitorsByCountry.push({
                id: "OTHERS",
                country: "Other Countries",
                value: othersVisits,
                visits: othersVisits,
                visitorCount: 0,
                flag: "",
                region: "Various"
            });
        }

        return res.status(200).json({
            status: true,
            data: visitorsByCountry,
            totalCountries: visitorsByCountry.length,
            totalVisits: totalVisits,
            summary: {
                topCountry: visitorsByCountry[0] || null,
                totalUniqueCountries: await Visitor.distinct("countryCode").then(count => count.length)
            }
        });

    } catch (err) {
        console.error("Error fetching pie chart data:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching pie chart data"
        });
    }
});

VisitorRouter.get("/monthly-visitors", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();

        // Monthly visitors aggregate karein
        const monthlyVisitors = await Visitor.aggregate([
            {
                $match: {
                    timeAdded: { $exists: true, $ne: "" }
                }
            },
            {
                $addFields: {
                    // Convert timeAdded string to date
                    visitDate: {
                        $toDate: {
                            $convert: {
                                input: "$timeAdded",
                                to: "long",
                                onError: null,
                                onNull: null
                            }
                        }
                    }
                }
            },
            {
                $match: {
                    visitDate: { $ne: null },
                    $expr: {
                        $eq: [{ $year: "$visitDate" }, currentYear]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$visitDate" }
                    },
                    totalVisits: { $sum: "$impression" },
                    uniqueVisitors: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.month": 1 }
            },
            {
                $project: {
                    month: "$_id.month",
                    totalVisits: 1,
                    uniqueVisitors: 1,
                    _id: 0
                }
            }
        ]);

        // All months ke liye data ensure karein (0 values for missing months)
        const allMonthsData = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (let i = 1; i <= 12; i++) {
            const existingMonth = monthlyVisitors.find(item => item.month === i);
            allMonthsData.push({
                month: monthNames[i - 1],
                value: existingMonth ? existingMonth.totalVisits : 0,
                uniqueVisitors: existingMonth ? existingMonth.uniqueVisitors : 0,
                monthNumber: i
            });
        }

        // Total calculations
        const totalYearVisits = allMonthsData.reduce((sum, item) => sum + item.value, 0);
        const totalUniqueVisitors = allMonthsData.reduce((sum, item) => sum + item.uniqueVisitors, 0);

        return res.status(200).json({
            status: true,
            data: allMonthsData,
            summary: {
                currentYear: currentYear,
                totalYearVisits: totalYearVisits,
                totalUniqueVisitors: totalUniqueVisitors,
                averageMonthlyVisits: Math.round(totalYearVisits / 12),
                peakMonth: allMonthsData.reduce((max, item) => item.value > max.value ? item : max, allMonthsData[0])
            }
        });

    } catch (err) {
        console.error("Error fetching monthly visitors data:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching monthly visitors data"
        });
    }
});

VisitorRouter.get("/dashboard-cards", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        // 🔹 Define current and last month range
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
        const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();

        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

        // 🧩 Aggregations for current and last month
        const [
            uniqueVisitorsCount,
            totalImpressionsData,
            todayActiveUsersCount,
            lastMonthVisitorsCount,
            lastMonthImpressionsData,
            lastMonthActiveUsersCount,
            totalUsersCount,
            lastMonthUsersCount
        ] = await Promise.all([
            // Current month Visitors
            Visitor.countDocuments({}), // total visitors all time

            Visitor.aggregate([
                { $group: { _id: null, totalImpressions: { $sum: "$impression" } } }
            ]),

            Visitor.countDocuments({
                currentTimeAdded: { $gte: todayStart.getTime(), $lt: todayEnd.getTime() }
            }),

            // Last month Visitors
            Visitor.countDocuments({
                timeAdded: { $gte: lastMonthStart, $lt: lastMonthEnd }
            }),

            Visitor.aggregate([
                { $match: { timeAdded: { $gte: lastMonthStart, $lt: lastMonthEnd } } },
                { $group: { _id: null, totalImpressions: { $sum: "$impression" } } }
            ]),

            Visitor.countDocuments({
                currentTimeAdded: { $gte: lastMonthStart, $lt: lastMonthEnd }
            }),

            // 🧠 New: Users Collection (All-time total users + last month users)
            User.countDocuments({}), // total users all time
            User.countDocuments({
                timeAdded: { $gte: lastMonthStart, $lt: lastMonthEnd }
            })
        ]);

        const totalImpressions = totalImpressionsData[0]?.totalImpressions || 0;
        const lastMonthImpressions = lastMonthImpressionsData[0]?.totalImpressions || 0;

        // 🔢 Helper to calculate percentage safely
        const calcPercentage = (current, previous) => {
            if (previous === 0) return 100;
            const diff = ((current - previous) / previous) * 100;
            return Math.round(diff * 10) / 10;
        };

        // 📊 Percentages and flags
        const visitorPercent = calcPercentage(uniqueVisitorsCount, lastMonthVisitorsCount);
        const impressionsPercent = calcPercentage(totalImpressions, lastMonthImpressions);
        const activePercent = calcPercentage(todayActiveUsersCount, lastMonthActiveUsersCount);
        const usersPercent = calcPercentage(totalUsersCount, lastMonthUsersCount);

        // 🧾 Final Data Response
        const data = [
            {
                key: "totalVisitors",
                title: "Total Visitors",
                value: uniqueVisitorsCount,
                description: "All recorded unique visitors",
                icon: "UserIcon",
                percentage: `${Math.abs(visitorPercent)}%`,
                isIncrease: visitorPercent >= 0
            },
            {
                key: "totalImpressions",
                title: "Total Views",
                value: totalImpressions,
                description: "Total visitor hits including revisits",
                icon: "EyeIcon",
                percentage: `${Math.abs(impressionsPercent)}%`,
                isIncrease: impressionsPercent >= 0
            },
            {
                key: "todayActive",
                title: "Today's Visitors",
                value: todayActiveUsersCount,
                description: "Visitors active in the last 24 hours",
                icon: "ClockIcon",
                percentage: `${Math.abs(activePercent)}%`,
                isIncrease: activePercent >= 0
            },
            {
                key: "registeredUsers",
                title: "Total Users",
                value: totalUsersCount,
                description: "Users registered on the platform",
                icon: "TrendingUp",
                percentage: `${Math.abs(usersPercent)}%`,
                isIncrease: usersPercent >= 0
            }
        ];

        return res.status(200).json({ status: true, data });

    } catch (err) {
        console.error("🚨 Error fetching dashboard summary cards:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching dashboard cards"
        });
    }
});

VisitorRouter.get("/", checkPermission("_visitors_", "get"), async (req, res) => {
    try {
        const visitorsData = await Visitor.aggregate([
            {
                $lookup: {
                    from: "users",
                    let: { visitorId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: ["$$visitorId", "$query"]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "roles",
                                localField: "role",
                                foreignField: "_id",
                                as: "roleDetails"
                            }
                        },
                        {
                            $unwind: {
                                path: "$roleDetails",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                username: 1,
                                email: 1,
                                profile_pic: 1,
                                timeAdded: 1,
                                lastLoginAt: 1,
                                roleName: "$roleDetails.name",
                                accessStatus: {
                                    $cond: {
                                        if: { $eq: ["$access.suspend", true] },
                                        then: "suspended",
                                        else: {
                                            $cond: {
                                                if: { $eq: ["$access.active", true] },
                                                then: "active",
                                                else: "inactive"
                                            }
                                        }
                                    }
                                },
                                uid: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    as: "associatedUsers"
                }
            },
            {
                $project: {
                    _id: 1,
                    country: 1,
                    city: 1,
                    countryCode: 1,
                    latitude: 1,
                    longitude: 1,
                    query: 1,
                    region: 1,
                    regionName: 1,
                    flag: 1,
                    timeAdded: 1,
                    currentTimeAdded: 1,
                    device: 1,
                    lastTimeAdded: 1,
                    impression: 1,
                    associatedUsers: {
                        $map: {
                            input: "$associatedUsers",
                            as: "user",
                            in: {
                                userId: "$$user._id",
                                username: "$$user.username",
                                email: "$$user.email",
                                profile_pic: "$$user.profile_pic",
                                timeAdded: "$$user.timeAdded",
                                lastLoginAt: "$$user.lastLoginAt",
                                roleName: "$$user.roleName",
                                accessStatus: "$$user.accessStatus",
                                uid: "$$user.uid",
                                createdAt: "$$user.createdAt"
                            }
                        }
                    },
                    totalAssociatedUsers: { $size: "$associatedUsers" }
                }
            },
            {
                $sort: { lastTimeAdded: -1 }
            }
        ]);

        // Agar koi visitor associated users ke bina hai, tou empty array set karo
        const formattedData = visitorsData.map(visitor => ({
            ...visitor,
            associatedUsers: visitor.associatedUsers || []
        }));

        return res.status(200).json({
            status: true,
            data: formattedData,
            summary: {
                totalVisitors: formattedData.length,
                totalImpressions: formattedData.reduce((sum, visitor) => sum + (visitor.impression || 0), 0),
                totalAssociatedUsers: formattedData.reduce((sum, visitor) => sum + visitor.totalAssociatedUsers, 0),
                uniqueCountries: [...new Set(formattedData.map(v => v.country))].length
            }
        });

    } catch (err) {
        console.error("Error fetching visitors data:", err);
        return res.status(500).json({
            status: false,
            message: "Server error while fetching visitors data"
        });
    }
});


export default VisitorRouter;