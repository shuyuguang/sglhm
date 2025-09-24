// ▼▼▼ 核心修正：确保从正确的位置导入 db 实例 ▼▼▼
import { db } from '../../db.js';

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 保存并返回逻辑 ---
    const saveButton = document.getElementById('save-btn');
    if (saveButton) {
        saveButton.addEventListener('click', function() {
            console.log("正在保存系统设置...");
            window.location.href = '../../app.html';
        });
    }

    // --- Tab 切换逻辑 ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            const targetPane = document.getElementById(button.dataset.tab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    // --- 数据库操作逻辑 ---
    const exportBtn = document.getElementById('export-local-btn');
    const importBtn = document.getElementById('import-local-btn');
    const clearBtn = document.getElementById('clear-local-btn');
    const fileInput = document.getElementById('import-file-input');

    // 1. 导出数据
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const allData = await db.keyValueStore.toArray();
                if (allData.length === 0) {
                    alert('数据库为空，无需导出。');
                    return;
                }

                const jsonString = JSON.stringify(allData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().slice(0, 10);
                a.download = `felotus_backup_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                alert('数据已成功导出！');

            } catch (error) {
                console.error('导出数据失败:', error);
                alert('导出数据时发生错误，请查看控制台获取更多信息。');
            }
        });
    }

    // 2. 导入数据
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (!confirm('警告：导入数据将完全覆盖您当前的本地数据，此操作不可撤销。确定要继续吗？')) {
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data) || (data.length > 0 && (!data[0].key || data[0].value === undefined))) {
                         throw new Error('文件格式不正确。');
                    }
                    
                    await db.transaction('rw', db.keyValueStore, async () => {
                        await db.keyValueStore.clear();
                        await db.keyValueStore.bulkPut(data);
                    });
                    
                    alert('数据导入成功！应用将重新加载以应用更改。');
                    window.location.reload();

                } catch (error) {
                    console.error('导入数据失败:', error);
                    alert(`导入失败：${error.message}`);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readText(file);
        });
    }

    // 3. 清除数据
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const confirmation = prompt('【极度危险】此操作将永久删除所有本地数据，包括用户、角色、设置等，且无法恢复！\n\n请输入 "确认删除" 来执行此操作。');
            if (confirmation === '确认删除') {
                try {
                    db.close();
                    await Dexie.delete('userSettingsDB');
                    alert('所有本地数据已被清除。应用将重新启动。');
                    window.location.href = '../../app.html';
                } catch (error) {
                    console.error('清除数据失败:', error);
                    alert('清除数据时发生错误，请查看控制台获取更多信息。');
                }
            } else {
                alert('操作已取消。');
            }
        });
    }
    
    console.log("系统设置页面加载完成，并已为按钮和Tab绑定事件。");
});