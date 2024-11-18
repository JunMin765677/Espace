// S3 上傳
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15000000, files: 5 },
});
vehicleRoutes.post('/uploadAttachments', sessionCheck, upload.array('attachments', 5), vehicleController.uploadAttachments);
const vehicleController = {    
    uploadAttachments: async (req, res) => {
        try {
            const attachments = req.files;
            let photoUrls = []; // 存储所有上传文件的 URL
    
            for (const file of attachments) {
                const extension = file.originalname.split('.').pop();
                const filename = ${uuid()}.${extension};
                const photoUrl = https://wakubase.s3.ap-northeast-1.amazonaws.com/images/${filename};
    
                // 上傳到 S3
                await s3Uploadv3([{
                    originalname: filename,
                    buffer: file.buffer
                }]);
                photoUrls.push(photoUrl);
            }
    
            const id = req.body.maintenanceId;
            if (!id) {
                return res.status(400).json({ error: 'Maintenance ID is required' });
            }
    
            // 動態選擇租戶資料庫
            const tenantId = req.tenant.id;
            const tenantDb = getTenantDatabase(tenant_${tenantId});
    
            // 查找維護記錄
            const maintenanceRecord = await tenantDb.VehicleMaintenance.findByPk(id);
            if (maintenanceRecord) {
                // 更新維護記錄的附件 URL
                await maintenanceRecord.update({ attachmentUrl: photoUrls });
    
                // 查詢維護記錄的車輛信息
                const vehicle = await tenantDb.Vehicle.findByPk(maintenanceRecord.vehicleId);
    
                // 記錄上傳附件操作到 EventLog
                await tenantDb.EventLog.create({
                    eventTime: new Date(),
                    eventType: '上傳維護附件', // 中文事件類型
                    relatedUser: req.user.id, // 操作的使用者
                    relatedMaintenance: id, // 關聯到維護記錄
                    relatedVehicle: vehicle.id, // 關聯到車輛
                    description: 上傳了附件，車牌為 ${vehicle.licensePlate}，維護類別為 ${maintenanceRecord.maintenanceType}。
                });
    
                res.status(201).json(maintenanceRecord.attachmentUrl);
            } else {
                res.status(404).json({ error: 'Maintenance record not found' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to upload attachments' });
        }
    }
}

// List.js
function updateMaintenanceList(maintenances) {
    contactList.clear();
    maintenances.forEach(maintenance => {
        // 格式化日期
        let formattedDate = maintenance.maintenanceDate 
            ? new Date(maintenance.maintenanceDate).toISOString().slice(0, 10).replace(/-/g, '/')
            : '-';

        // 處理圖片 URL
        let photoUrl = maintenance.vehicle?.photoUrl || '/assets/images/small/vehicle_default.png'; 

        // 處理 maintenanceType
        let maintenanceType = maintenance.maintenanceType || '-';
        let tagsHtml = maintenanceType !== '-' 
            ? maintenanceType.split(', ').map(type => `<span class="badge bg-primary-subtle text-primary me-1">${type.trim()}</span>`).join('')
            : '<span class="badge bg-secondary-subtle text-secondary">無</span>';

        // console.log(maintenance.vehicle);

        // 處理 User 資料
        let department = maintenance.user?.department || '';
        let fullName = maintenance.user?.fullName || maintenance.user?.email || '-';

        // 處理 licensePlate 顯示邏輯
        let licensePlateDisplay = maintenance.vehicle?.vehicleType 
        ? `${maintenance.vehicle.make}, ${maintenance.vehicle.vehicleType}` 
        : maintenance.vehicle?.make || '-';
    
        // console.log(maintenance.vehicleId);

        contactList.add({
            id: `<a href="javascript:void(0);" class="fw-medium link-primary">${maintenance.id}</a>`,
            licensePlate: 
                `<div class="d-flex align-items-center">
                    <div class="flex-shrink-0">
                        <img src="${photoUrl}" alt="" class="avatar-xs rounded-circle" style="object-fit: cover;">
                    </div>
                    <div class="flex-grow-1 ms-2 name">
                        ${maintenance.vehicle.licensePlate}, ${licensePlateDisplay}
                    </div>
                </div>`,
            vehicleType: maintenance.vehicle?.vehicleType,
            make: maintenance.vehicle.make,
            maintenanceType: tagsHtml,
            cost: `${maintenance.cost || '0'}元`,
            maintenanceDate: formattedDate,
            action: 
                `<li>
                    <a href="javascript:void(0);" class="dropdown-item view-item-btn" data-id="${maintenance.id}" onclick="showOffcanvas(this)">
                        <i class="ri-eye-fill align-bottom me-2 text-muted"></i>
                    </a>
                </li>
                <li>
                    <a class="dropdown-item edit-item-btn" user-id="${maintenance.userId}" data-id="${maintenance.id}">
                        <i class="ri-pencil-fill align-bottom me-2 text-muted"></i>
                    </a>
                </li>
                <li>
                    <a class="dropdown-item remove-item-btn" user-id="${maintenance.userId}" data-id="${maintenance.id}">
                        <i class="ri-delete-bin-fill align-bottom me-2 text-muted"></i>
                    </a>
                </li>`,
            maintenanceId: maintenance.id,
            details: maintenance.details,
            photoUrl: photoUrl,
            infoLicensePlate: maintenance.vehicle.licensePlate, 
            infoVehicleType: maintenance.vehicle.vehicleType,
            attachmentUrl: maintenance.attachmentUrl,
            vehicleId: maintenance.vehicleId,
            typeForEdit: maintenance.maintenanceType,
            dateForEdit: maintenance.maintenanceDate,
            costForEdit: maintenance.cost,
            department: department, // 若為空則不顯示
            fullName: fullName, // 顯示 fullName 或 email
        });
    });
    contactList.sort('maintenanceId', { order: "desc" });
}

