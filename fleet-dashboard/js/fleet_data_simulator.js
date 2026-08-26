// fleet_data_simulator.js
// Generates realistic mock data for 10 HD785-7 dumpers

const dumpers = ["N27", "N28", "N29", "N30", "N35", "N36", "N37", "N38", "N39", "N40"];

const limits = {
    fuel_rate_max: 65, // L/h
    suspension_imbalance_max: 25, // %
    retarder_temp_max: 85, // Celsius
    payload_max: 110, // Tons
    idle_time_max: 35 // %
};

function generateRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function generateDailyData() {
    const data = {};
    dumpers.forEach(id => {
        // Introduce some anomalies for specific dumpers to demonstrate the alert engine
        const isFuelAnomaly = id === "N38";
        const isSuspensionAnomaly = id === "N29";
        const isTempAnomaly = id === "N35";
        const isIdleAnomaly = id === "N40";

        data[id] = {
            fuel_rate: generateRandom(isFuelAnomaly ? 60 : 40, isFuelAnomaly ? 75 : 55),
            suspension_imbalance: generateRandom(isSuspensionAnomaly ? 20 : 5, isSuspensionAnomaly ? 35 : 15),
            retarder_temp: generateRandom(isTempAnomaly ? 75 : 45, isTempAnomaly ? 95 : 65),
            payload_avg: generateRandom(85, 105),
            idle_time: generateRandom(isIdleAnomaly ? 30 : 15, isIdleAnomaly ? 50 : 25),
            trips_completed: Math.floor(generateRandom(18, 30)),
            distance_travelled: generateRandom(120, 180) // km
        };
    });
    return data;
}

function generateMonthlyData() {
    const data = {};
    const days = Array.from({length: 30}, (_, i) => `Day ${i+1}`);
    
    dumpers.forEach(id => {
        data[id] = {
            trend_fuel: days.map(() => generateRandom(45, 60)),
            trend_payload: days.map(() => generateRandom(85, 105)),
            trend_suspension: days.map(() => generateRandom(5, 20)),
            total_trips: Math.floor(generateRandom(500, 800)),
            total_distance: generateRandom(3000, 5000)
        };
        // Inject a spike for demonstration
        if (id === "N29") {
            data[id].trend_suspension[15] = 32;
            data[id].trend_suspension[16] = 35;
        }
    });
    
    return { days, dumpers: data };
}

window.FleetData = {
    dumpers: dumpers,
    limits: limits,
    daily: generateDailyData(),
    monthly: generateMonthlyData()
};
