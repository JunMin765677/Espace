// 後端處理邏輯
const vehicleController = {    
    createEvent: async (req, res) => {
        try {
            const { role, vehicleId, borrowerId, purpose, location, description, borrowDate, returnDate, allDay } = req.body;
            const tenantId = req.tenant.id;
            const tenantDb = getTenantDatabase(`tenant_${tenantId}`);
            
            // 衝突查詢
            const conflictEvents = await tenantDb.VehicleBorrowing.findAll({
                where: {
                    vehicleId: vehicleId,
                    [Op.and]: [
                        { status: { [Op.is]: null } },  
                        {
                            borrowDate: {
                                [Op.lte]: returnDate
                            },
                            returnDate: {
                                [Op.gte]: borrowDate
                            }
                        }
                    ]
                }
            });
    
            if (role === 'admin') {
                if (conflictEvents.length > 0) {
                    // 更新衝突事件的狀態為 "被取消"
                    for (let event of conflictEvents) {
                        event.status = "canceled";
                        await event.save();
    
                        // 發送電子郵件通知（選擇性實現）
                        // await sendCancellationEmail(event.borrowerId, event);
                    }
                }
    
                // 允許建立新的事件
                const newEvent = await tenantDb.VehicleBorrowing.create({
                    vehicleId,
                    borrowerId,
                    purpose,
                    location,
                    description,
                    borrowDate,
                    returnDate,
                    allDay,
                });
    
                // 記錄創建新事件到 EventLog
                await tenantDb.EventLog.create({
                    eventTime: new Date(),
                    eventType: '創建預約', // 中文事件類型
                    relatedUser: req.user.id, // 假設 req.user 中有當前操作的使用者
                    relatedBorrowing: newEvent.id, // 關聯到新創建的 VehicleBorrowing
                    relatedVehicle: vehicleId,
                    description: `創建了新的預約，使用事由為 ${purpose}，使用時間為 ${formatEventDates(borrowDate, returnDate)}。`
                });
    
                res.json({ success: true, message: "事件已創建並取消了衝突的預約", event: newEvent });
    
            } else {
                // 非 admin 使用者，正常處理衝突
                if (conflictEvents.length > 0) {
                    return res.status(409).json({ 
                        success: false, 
                        message: '該車輛在所選時間段內已被預約。' 
                    });
                }
    
                // 沒有衝突，創建新的事件
                const newEvent = await tenantDb.VehicleBorrowing.create({
                    vehicleId,
                    borrowerId,
                    purpose,
                    location,
                    description,
                    borrowDate,
                    returnDate,
                    allDay,
                });
    
                // 記錄創建新事件到 EventLog
                await tenantDb.EventLog.create({
                    eventTime: new Date(),
                    eventType: '創建預約', // 中文事件類型
                    relatedUser: req.user.id, // 假設 req.user 中有當前操作的使用者
                    relatedBorrowing: newEvent.id, // 關聯到新創建的 VehicleBorrowing
                    relatedVehicle: vehicleId,
                    description: `創建了新的預約，使用事由為 ${purpose}，使用時間為 ${formatEventDates(borrowDate, returnDate)}。`
                });
    
                res.json({ success: true, event: newEvent });
            }
        } catch (error) {
            console.error("Error creating an event: ", error);
            res.status(500).json({ success: false, message: '創建事件時發生錯誤，請稍後再試。' });
        }
    },
}

// 前端 FullCalendar
var calendar = new FullCalendar.Calendar(calendarEl, {
    timeZone: 'UTC',  
    editable: true,  // 允許用戶編輯事件
    dayMaxEventRows: true,  // 允許多行事件顯示
    dayMaxEvents: 3,
    droppable: true,  // 允許用戶拖拽事件
    selectable: true,  // 允許用戶選擇日期和時間
    navLinks: true,  // 啟用日曆視圖間的導航連結
    initialView: getInitialView(),  // 初始視圖根據螢幕寬度調整
    themeSystem: 'bootstrap',  // 使用 Bootstrap 主題
    headerToolbar: {  // 設定日曆的頭部工具欄
        left: 'prev,next today',  // 左側按鈕：前一日/後一日、今日
        center: 'title',  // 中間顯示日曆標題
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'  // 右側按鈕：月視圖、週視圖、日視圖、列表月視圖
    },
    locale: 'zh-tw',  // 設定語言為繁體中文
    moreLinkText: "筆",  // 修改為中文
    loading: function(isLoading) {
        if (isLoading) {
            // 正在加載事件時顯示指示器
            loadingIndicator.style.display = 'block';
        } else {
            // 加載完成後隱藏指示器
            loadingIndicator.style.display = 'none';
        }
    },
    windowResize: function (view) {  // 螢幕大小改變時調整日曆視圖
        var newView = getInitialView();
        calendar.changeView(newView);
    },
    eventResize: function(info) {  // 事件大小變化時更新事件數據
        var indexOfSelectedEvent = defaultEvents.findIndex(function (x) {
            return x.id == info.event.id;
        });
        if (defaultEvents[indexOfSelectedEvent]) {
            // 更新事件資料
            defaultEvents[indexOfSelectedEvent].title = info.event.title;
            defaultEvents[indexOfSelectedEvent].start = info.event.start;
            defaultEvents[indexOfSelectedEvent].end = info.event.end ? info.event.end : null;
            defaultEvents[indexOfSelectedEvent].allDay = info.event.allDay;
            defaultEvents[indexOfSelectedEvent].className = info.event.classNames[0];
            defaultEvents[indexOfSelectedEvent].description = info.event._def.extendedProps.description ? info.event._def.extendedProps.description : '';
            defaultEvents[indexOfSelectedEvent].location = info.event._def.extendedProps.location ? info.event._def.extendedProps.location : '';
        }
        // upcomingEvent(defaultEvents);  // 更新即將發生的事件列表
    },
    eventClick: function (info) { 
        // console.log(info.event); 
        // console.log("Event Start:", info.event.start);
        // console.log("Event End:", info.event.end);
    
        // Readonly
        readonlyFillIn(info);
        const readonlyModal = new bootstrap.Modal(document.getElementById('readonlyModal'));
        readonlyModal.show();

        // update fill in
        document.getElementById('readonly-btn-update').onclick = function() {
            readonlyModal.hide();
            const updateModal = new bootstrap.Modal(document.getElementById('updateModal'));
            updateFillIn(info);
            updateModal.show();

            // Cancel update and return to readonly modal
            document.getElementById('cancelUpdateButton').onclick = function() {
                updateModal.hide();
                readonlyModal.show();
            };
        };

        // update submit
        document.getElementById('updateForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const startDate = document.getElementById('update-start-date').value;
            const allDay = document.getElementById('update-allDay').checked;
            const startTime = document.getElementById('update-timepicker1').value;
            const endTime = document.getElementById('update-timepicker2').value;

            let isValid = true;

            // 如果未勾選「全日事件」，檢查時間選擇器
            if (!allDay) {
                if (!startTime || !endTime) {
                    if (!startTime) {
                        document.getElementById('update-timepicker1').classList.add('is-invalid');
                        Swal.fire({
                            title: '錯誤',
                            text: '請選擇開始時間',
                            icon: 'warning',
                            confirmButtonText: '確定'
                        });
                    }
                    if (!endTime) {
                        document.getElementById('update-timepicker2').classList.add('is-invalid');
                        Swal.fire({
                            title: '錯誤',
                            text: '請選擇結束時間',
                            icon: 'warning',
                            confirmButtonText: '確定'
                        });
                    }
                    isValid = false;
                } else if (startTime >= endTime) {
                    document.getElementById('update-timepicker2').classList.add('is-invalid');
                    Swal.fire({
                        title: '錯誤',
                        text: '結束時間必須晚於開始時間',
                        icon: 'warning',
                        confirmButtonText: '確定'
                    });
                    isValid = false;
                } else {
                    document.getElementById('update-timepicker1').classList.remove('is-invalid');
                    document.getElementById('update-timepicker2').classList.remove('is-invalid');
                }
            }
            
            if (!isValid) {
                return;
            }
                            
            const bookingInfo = processBookingDates(startDate, allDay, startTime, endTime);
                    
            const eventId = document.getElementById('update-eventId').value;
            const data = {
                borrowDate: bookingInfo.borrowDate,  
                returnDate: bookingInfo.returnDate,  
                allDay: bookingInfo.allDay,        
                vehicleId: document.getElementById("update-choices-vehicle").value,
                purpose: document.getElementById("update-title").value,
                location: document.getElementById('update-location').value,
                description: document.getElementById('update-description').value,
            };
        
            fetch('/vehicle/updateEvents/' + eventId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                const updateModalElement = document.getElementById('updateModal');
                const updateModalInstance = bootstrap.Modal.getInstance(updateModalElement);

                // 這裡我需要把updateModal關掉
                if(data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: '更新成功',
                        showConfirmButton: false,
                        timer: 1500
                    }).then(() => {
                        updateModalInstance.hide();
                        calendar.refetchEvents();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: '更新失敗',
                        text: data.message
                    }).then(() => {
                        // updateModalInstance.hide(); 
                    });
                }

            })
            .catch(error => {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: '發生錯誤',
                    text: error.toString()
                }).then(() => {
                    const updateModalElement = document.getElementById('updateModal');
                    const updateModalInstance = bootstrap.Modal.getInstance(updateModalElement);
                    updateModalInstance.hide(); // 隱藏updateModal
                });
            });
        
        });

        // delete click
        document.getElementById('readonly-btn-delete').onclick = function() {
            Swal.fire({
                title: '確定要刪除這個事件嗎?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '<i class="ri-delete-bin-line align-bottom"></i> 是的，刪除!',
                cancelButtonText: '<i class="ri-close-line align-bottom"></i> 取消',
                customClass: {
                    confirmButton: 'btn btn-soft-danger btn-border',
                    cancelButton: 'btn btn-soft-dark btn-border'
                },
                buttonsStyling: false,  // 禁用默认样式，以便应用自定义样式
                didOpen: () => {
                    const confirmButton = Swal.getConfirmButton();
                    const cancelButton = Swal.getCancelButton();

                    confirmButton.style.marginRight = '10px';  // 设置右边距
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    // 如果用戶確認刪除，則執行刪除操作
                    fetch('/vehicle/deleteEvents/' + info.event.id, {
                        method: 'DELETE',
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('網絡響應不是 ok');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Delete response:', data);
                        if (data.success) {
                            Swal.fire({
                                icon: 'success',
                                title: '事件已成功刪除',
                                showConfirmButton: false,
                                timer: 1500
                            }).then(() => {
                                readonlyModal.hide();
                                calendar.refetchEvents();
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: '刪除失敗',
                                text: data.message,
                            });
                        }
                    })
                    .catch(error => {
                        console.error('刪除事件錯誤:', error);
                        Swal.fire({
                            icon: 'error',
                            title: '刪除事件失敗',
                            text: error.message,
                        });
                    });
                }
            });
        };
    },
    dateClick: function (info) {  // 點擊日期時添加新事件
        // 初始化或重置 Step1 的狀態
        initializeStep1(info.date);
    
        // Step2 表單提交處理
        const createStep2Form = document.getElementById('createStep2Form');
        createStep2Form.removeEventListener('submit', handleStep2Submit);  // 移除之前的監聽器，防止重複綁定
        createStep2Form.addEventListener('submit', handleStep2Submit);     // 添加新的監聽器
    },
    events: function(fetchInfo, successCallback, failureCallback) {
        fetch('/vehicle/events')
            .then(response => response.json())
            .then(data => {
                const events = data.map(event => {
                    const start = new Date(event.start).toISOString();
                    const end = new Date(event.end).toISOString();
    
                    // console.log(`Event ID: ${event.purpose}`);
                    // console.log(`Original Start: ${event.start}`);
                    // console.log(`Converted Start: ${start}`);
                    // console.log(`Original End: ${event.end}`);
                    // console.log(`Converted End: ${end}`);
                    // console.log(event)
    
                    return {
                        id: event.id,
                        title: event.purpose,
                        start: start,
                        end: end,
                        allDay: event.allDay,
                        description: event.description,
                        location: event.location,
                        vehicleId: event.vehicleId,
                        vehicle: event.vehicle ? { 
                            make: event.vehicle.make,
                            licensePlate: event.vehicle.licensePlate,
                            vehicleType: event.vehicle.vehicleType,
                            photoUrl: event.vehicle.photoUrl
                        } : null,
                        borrower: event.borrower ? { 
                            name: event.borrower.name,
                            email: event.borrower.email,
                            department: event.borrower.department,
                            fullName: event.borrower.fullName,
                            photo: event.borrower.photo,
                        } : null
                    };
                });
                successCallback(events);  // 傳遞給 FullCalendar
            })
            .catch(error => {
                console.error('Error fetching events:', error);
                failureCallback(error);
            });
    },
    // events: '/vehicle/events',  // 從後端API加載事件數據
    eventDidMount: function(info) {
        // console.log('Event Start:', info.event.start);  // 檢查事件的開始時間
        // console.log('Event End:', info.event.end);      // 檢查事件的結束時間
        // console.log('Event Start (UTC):', info.event.start.toISOString());  // 以 UTC 格式顯示事件開始時間
        // console.log('Event End (UTC):', info.event.end.toISOString());    // 以 UTC 格式顯示事件結束時間
    },
    eventContent: function(info) {
        let title = document.createElement('div');

        if (info.event.allDay) {
            // 如果是全日事件，顯示車輛號碼及開始日期
            title.innerHTML = `<b>${info.event.extendedProps.vehicle.licensePlate}</b> 全天`;
        } else {
            // 如果是非全日事件，顯示車輛號碼及開始時間
            title.innerHTML = `<b>${info.event.extendedProps.vehicle.licensePlate}</b>`;
        }
    
        return { domNodes: [title] };
    },
    eventReceive: function (info) {  // 接收新的外部事件並加入到事件列表
        var newid = parseInt(info.event.id);
        var newEvent = {
            id: newid,
            title: info.event.title,
            start: info.event.start,
            allDay: info.event.allDay,
            className: info.event.classNames[0]
        };
        defaultEvents.push(newEvent);
        // upcomingEvent(defaultEvents);
    },
    eventDrop: function (info) {  // 拖放事件時更新事件數據
        updateEvent(info.event);
    }
});
