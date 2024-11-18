// 後端 Sequelize 處理
const vehicleController = {    
     getMonthlyMaintenanceCosts: async (req, res) => {
        try {
            // 計算從當前月份開始的過去五個月
            const now = new Date();
            const startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 5); // 過去五個月的起始日期
    
            const tenantId = req.tenant.id;
            const tenantDb = getTenantDatabase(`tenant_${tenantId}`);

            // 查詢過去六個月的維護數據
            const maintenanceData = await tenantDb.VehicleMaintenance.findAll({
                where: {
                    maintenanceDate: {
                        [Op.between]: [startDate, now] // 限制為最近六個月
                    }
                },
                attributes: [
                    [Sequelize.fn('MONTH', Sequelize.col('maintenanceDate')), 'month'], // 按月份分組
                    'maintenanceType', // 按維護類別分組
                    [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost'] // 每類別的維護總金額
                ],
                group: ['month', 'maintenanceType'],
                order: [[Sequelize.fn('MONTH', Sequelize.col('maintenanceDate')), 'ASC']] // 以月份升序排列
            });
    
            // 格式化資料，讓前端方便解析和顯示
            const formattedData = formatStackedChartData(maintenanceData);
    
            res.status(200).json({
                success: true,
                data: formattedData
            });
        } catch (error) {
            console.error('Error fetching monthly maintenance costs:', error);
            res.status(500).json({
                success: false,
                message: '伺服器錯誤，無法獲取維護成本數據。'
            });
        }
    },
}


// 前端 ApexCharts & AJAX
async function loadMonthlyMaintenanceCosts() {
    try {
        // 發送 GET 請求，獲取維護費用的數據
        const response = await fetch('/vehicle/getMonthlyMaintenanceCosts');
        const data = await response.json();

        if (data.success) {
            const categories = data.data.categories;  // X 軸，表示月份
            const series = data.data.series;  // Y 軸，表示維護類別和金額

            // 構建 ApexCharts 的選項
            const options = {
                series: series,  // 使用 API 返回的每個維護類別的數據
                chart: {
                    type: 'bar',  // 柱狀圖
                    height: 700,
                    stacked: true,  // 堆疊
                    toolbar: {
                        show: true, // 顯示工具列
                        tools: {
                            download: true, // 允許下載
                            selection: true,
                            zoom: true,
                            zoomin: true,
                            zoomout: true,
                            pan: true,
                            reset: true,
                        },
                        export: {
                            csv: {
                                filename: "維護成本分析 Historical record statistics",
                                columnDelimiter: ',',
                                headerCategory: '類別',
                                headerValue: '值',
                                dateFormatter(timestamp) {
                                    return new Date(timestamp).toLocaleDateString();
                                }
                            },
                            svg: {
                                filename: "維護成本分析 Historical record statistics",
                            },
                            png: {
                                filename: "維護成本分析 Historical record statistics",
                            }
                        },
                        autoSelected: 'zoom' // 預設選中的工具
                    },
                    locales: [{
                        name: 'zh-TW',
                        options: {
                            toolbar: {
                                exportToSVG: '下載 SVG',
                                exportToPNG: '下載 PNG',
                                exportToCSV: '下載 CSV',
                                selection: '選擇',
                                selectionZoom: '選擇縮放',
                                zoomIn: '放大',
                                zoomOut: '縮小',
                                pan: '平移',
                                reset: '重置縮放'
                            }
                        }
                    }],
                    defaultLocale: 'zh-TW',
                },
                plotOptions: {
                    bar: {
                        horizontal: false,  // 垂直柱狀圖
                        // borderRadius: 30,  // 圓角柱狀圖
                        distributed: false  // 確保不分散顏色
                    },
                },
                xaxis: {
                    categories: categories,  // X 軸顯示月份
                    title: {
                        text: '月份'  // X 軸標題
                    }
                },
                yaxis: {
                    title: {
                        text: '金額 (NT$)'  // Y 軸標題
                    }
                },
                legend: {
                    position: 'top',  // 圖例顯示在頂部
                    horizontalAlign: 'center'
                },
                fill: {
                    opacity: 1
                },
                colors: ['#A8DADC', '#457B9D', '#F4A261', '#E9C46A', '#F6BD60', '#E5989B', '#6D6875', '#83C5BE'],  // 顏色配置
            };

            // 銷毀現有圖表並重新渲染
            const chartContainer = document.querySelector("#monthly-maintenance-chart");
            if (chartContainer.chart) {
                chartContainer.chart.destroy();
            }

            // 渲染新圖表
            const chart = new ApexCharts(chartContainer, options);
            chart.render();

        } else {
            console.error('Error: Failed to load maintenance cost data');
        }
    } catch (error) {
        console.error('Error fetching monthly maintenance costs:', error);
    }
}
loadMonthlyMaintenanceCosts();
