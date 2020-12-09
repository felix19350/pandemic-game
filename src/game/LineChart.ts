import * as Highcharts from 'highcharts';
import { nFormatter } from '../lib/util';

export const buildCasesChart = (containerId: string, caseSeries: any[], totalCostSeries: any[], hospitalCapacity:Number) => {
    return Highcharts.chart(containerId, {
        chart: {
            type: 'line'
        },
        title: {
            text: ''
        },
        credits: {
            enabled: false
        },
        legend: {
            enabled: false
        },
        xAxis: {
            lineWidth: 0,
            minorGridLineWidth: 0,
            labels: {
                enabled: false
            },
            minorTickLength: 0,
            tickLength: 0
        },
        yAxis: [
            {
                title: {
                    text: 'Cases/day',
                    style: {
                        color: 'blue'
                    }
                },
                labels: {
                    style: {
                        color: 'blue'
                    }
                },
                min: 0,
				plotLines: [{
					value: hospitalCapacity,
					color: '#C00000',
					dashStyle: 'shortdash',
					width: 1,
					label: {
						text: 'hospital capacity'
					}
				}],
            },
            {
                title: {
                    text: 'USD',
                    style: {
                        color: 'red'
                    }
                },
                labels: {
                    style: {
                        color: 'red'
                    }
                },
                min: 0,
                opposite: true
            }
        ],
        tooltip: {
            formatter: function () {
                const date = (this.x as any).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                console.log(date);
                return this.points.reduce(function (prev, point) {
                    return `${prev}<br/> ${point.series.name}: ${nFormatter(point.y, 1)}`;
                }, `<b>${date}<br/>`);
            },
            shared: true
        },
        series: [
            {
                type: 'line',
                name: 'Cases/day',
                data: caseSeries,
                yAxis: 0,
                color: 'blue'
            },
            {
                type: 'line',
                name: 'Costs',
                data: totalCostSeries,
                yAxis: 1,
                color: 'red'
            }
        ]
    });
};

export const updateCasesChart = (casesChart: any, caseSeries: any[], totalCostSeries: any[]) => {
    casesChart.series[0].setData(caseSeries);
    casesChart.series[1].setData(totalCostSeries);
};
