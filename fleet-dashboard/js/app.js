// app.js
// Core logic for the Fleet Intelligence Dashboard

// Initialize Chart.js defaults for dark theme
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b';
Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
Chart.defaults.plugins.tooltip.borderColor = '#334155';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.legend.labels.usePointStyle = true;

let currentView = 'daily'; // 'daily' or 'monthly'
let charts = {};

function init() {
    renderDashboard();
    
    document.getElementById('view-select').addEventListener('change', (e) => {
        currentView = e.target.value;
        renderDashboard();
    });
}

function renderDashboard() {
    updateMetrics();
    renderCharts();
    generateAlertsAndInsights();
}

function updateMetrics() {
    const data = FleetData[currentView];
    let totalPayload = 0, totalFuel = 0, activeDumpers = FleetData.dumpers.length;
    
    if (currentView === 'daily') {
        Object.values(data).forEach(d => {
            totalPayload += d.payload_avg;
            totalFuel += d.fuel_rate;
        });
        document.getElementById('m-payload').textContent = Math.round(totalPayload / activeDumpers);
        document.getElementById('m-fuel').textContent = Math.round(totalFuel / activeDumpers);
        document.getElementById('m-active').textContent = activeDumpers;
        document.getElementById('m-title-payload').textContent = 'FLEET AVG PAYLOAD';
        document.getElementById('m-title-fuel').textContent = 'FLEET AVG FUEL RATE';
    } else {
        Object.values(data.dumpers).forEach(d => {
            totalPayload += d.trend_payload.reduce((a,b)=>a+b,0) / d.trend_payload.length;
            totalFuel += d.trend_fuel.reduce((a,b)=>a+b,0) / d.trend_fuel.length;
        });
        document.getElementById('m-payload').textContent = Math.round(totalPayload / activeDumpers);
        document.getElementById('m-fuel').textContent = Math.round(totalFuel / activeDumpers);
        document.getElementById('m-active').textContent = activeDumpers;
        document.getElementById('m-title-payload').textContent = 'MONTHLY AVG PAYLOAD';
        document.getElementById('m-title-fuel').textContent = 'MONTHLY AVG FUEL RATE';
    }
}

function renderCharts() {
    // Destroy existing charts
    Object.values(charts).forEach(c => c.destroy());
    
    if (currentView === 'daily') {
        renderDailyCharts();
    } else {
        renderMonthlyCharts();
    }
}

function renderDailyCharts() {
    const data = FleetData.daily;
    const labels = FleetData.dumpers;
    
    // 1. Fuel Comparison Bar Chart
    const fuelCtx = document.getElementById('chart-primary').getContext('2d');
    charts.primary = new Chart(fuelCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Avg Fuel Rate (L/h)',
                data: labels.map(id => data[id].fuel_rate),
                backgroundColor: labels.map(id => data[id].fuel_rate > FleetData.limits.fuel_rate_max ? '#ef4444' : '#3b82f6'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: '#334155' } }, x: { grid: { display: false } } },
            plugins: { title: { display: true, text: 'Daily Fuel Rate Comparison', color: '#f8fafc' } }
        }
    });

    // 2. Suspension Radar Chart
    const suspCtx = document.getElementById('chart-secondary').getContext('2d');
    charts.secondary = new Chart(suspCtx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Suspension Imbalance (%)',
                data: labels.map(id => data[id].suspension_imbalance),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                pointBackgroundColor: labels.map(id => data[id].suspension_imbalance > FleetData.limits.suspension_imbalance_max ? '#ef4444' : '#10b981')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { angleLines: { color: '#334155' }, grid: { color: '#334155' }, pointLabels: { color: '#94a3b8' } } },
            plugins: { title: { display: true, text: 'Suspension Health (Imbalance %)', color: '#f8fafc' } }
        }
    });
}

function renderMonthlyCharts() {
    const data = FleetData.monthly;
    const labels = data.days;
    
    // Monthly Fuel Trend (Line Chart)
    const datasets = FleetData.dumpers.map((id, index) => {
        // Use a color palette
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'];
        return {
            label: id,
            data: data.dumpers[id].trend_fuel,
            borderColor: colors[index],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
        };
    });

    const trendCtx = document.getElementById('chart-primary').getContext('2d');
    charts.primary = new Chart(trendCtx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { grid: { color: '#334155' } }, x: { grid: { display: false } } },
            plugins: { title: { display: true, text: 'Monthly Fuel Trend (L/h)', color: '#f8fafc' } }
        }
    });

    // Monthly Trips Comparison
    const tripsCtx = document.getElementById('chart-secondary').getContext('2d');
    charts.secondary = new Chart(tripsCtx, {
        type: 'bar',
        data: {
            labels: FleetData.dumpers,
            datasets: [{
                label: 'Total Trips Completed',
                data: FleetData.dumpers.map(id => data.dumpers[id].total_trips),
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: '#334155' } }, x: { grid: { display: false } } },
            plugins: { title: { display: true, text: 'Total Trips (Monthly)', color: '#f8fafc' } }
        }
    });
}

function generateAlertsAndInsights() {
    const list = document.getElementById('alerts-list');
    list.innerHTML = '';
    
    let alerts = [];
    const limits = FleetData.limits;

    if (currentView === 'daily') {
        const data = FleetData.daily;
        FleetData.dumpers.forEach(id => {
            const d = data[id];
            
            // Operations Alerts
            if (d.fuel_rate > limits.fuel_rate_max) {
                alerts.push({ type: 'warning', icon: '⛽', text: `<strong>${id}</strong> fuel rate is extremely high (${Math.round(d.fuel_rate)} L/h).`, action: 'Operations: Advise operator on throttle control.' });
            }
            if (d.idle_time > limits.idle_time_max) {
                alerts.push({ type: 'info', icon: '⏱️', text: `<strong>${id}</strong> has excessive idle time (${Math.round(d.idle_time)}%).`, action: 'Operations: Check loading queue or operator breaks.' });
            }
            if (d.payload_avg > limits.payload_max) {
                alerts.push({ type: 'critical', icon: '⚠️', text: `<strong>${id}</strong> is consistently overloaded (Avg: ${Math.round(d.payload_avg)}t).`, action: 'Operations: Alert excavator operator immediately to reduce passes.' });
            }

            // Maintenance Alerts
            if (d.suspension_imbalance > limits.suspension_imbalance_max) {
                alerts.push({ type: 'critical', icon: '🔧', text: `<strong>${id}</strong> critical lateral suspension imbalance (${Math.round(d.suspension_imbalance)}%).`, action: 'Maintenance: Inspect struts and nitrogen charging immediately.' });
            }
            if (d.retarder_temp > limits.retarder_temp_max) {
                alerts.push({ type: 'warning', icon: '🔥', text: `<strong>${id}</strong> retarder oil temperature is overheating (${Math.round(d.retarder_temp)}°C).`, action: 'Maintenance: Check cooling system. Operations: Check descent braking habits.' });
            }
        });
    } else {
        // Monthly Insights
        const data = FleetData.monthly.dumpers;
        FleetData.dumpers.forEach(id => {
            const suspSpikes = data[id].trend_suspension.filter(v => v > limits.suspension_imbalance_max).length;
            if (suspSpikes > 3) {
                 alerts.push({ type: 'critical', icon: '🔧', text: `<strong>${id}</strong> had ${suspSpikes} days of critical suspension imbalance this month.`, action: 'Maintenance: Schedule major suspension overhaul.' });
            }
            
            const avgFuel = data[id].trend_fuel.reduce((a,b)=>a+b,0) / 30;
            if (avgFuel > limits.fuel_rate_max - 5) {
                alerts.push({ type: 'warning', icon: '⛽', text: `<strong>${id}</strong> monthly average fuel is very high (${Math.round(avgFuel)} L/h).`, action: 'Maintenance: Check fuel injectors & filters.' });
            }
        });
    }

    if (alerts.length === 0) {
        list.innerHTML = `<div class="alert-item info"><span class="alert-icon">✅</span><div class="alert-content">All fleet parameters are within normal limits.</div></div>`;
        return;
    }

    // Sort: critical first
    alerts.sort((a, b) => {
        const order = { critical: 1, warning: 2, info: 3 };
        return order[a.type] - order[b.type];
    });

    alerts.forEach(a => {
        list.innerHTML += `
            <div class="alert-item ${a.type}">
                <span class="alert-icon">${a.icon}</span>
                <div class="alert-content">
                    ${a.text}
                    <span class="action">${a.action}</span>
                </div>
            </div>
        `;
    });
}

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
