// profile.manager.js

/**
 * 管理器创建函数 (指挥中心)
 * 负责组装所有模块并返回公共接口
 */
function createProfileManager(config) {
    // 1. 初始化数据库和共享状态
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({ keyValueStore: 'key' });

    const state = {
        // 从 config 传入的
        elements: config.elements,
        uiStyle: config.uiStyle,
        renderSwitcher: config.renderSwitcher,
        onProfileSave: config.onProfileSave,
        
        // 内部状态
        profileData: [],
        presetContentStore: {},
        currentProfileId: null,
        currentMode: 'YOU',
        activeCustomPane: null,
        currentPromptAction: null,
        elementBeingEdited: null,
        longPressTimer: null,
        isLongPress: false,
        currentSaveCallback: null,
        currentItemEditingContext: { pane: null, item: null },
        croppingContext: {},
        selectedProfileIds: [],
        isMultiSelectMode: false,

        // ▼▼▼ 新增开始 ▼▼▼
        selectedCharForRel: null, // {id, name, avatar}
        selectedRelationshipTypes: [], // 修改：从 null 改为数组 []
        // ▲▲▲ 新增结束 ▲▲▲

        // 动态计算的函数
        getDbKey: null,
        getDefaultProfileId: null
    };

    // 2. 创建各个模块实例 (依赖注入)
    const ui = createUiManager(config.elements, state, { GENDER_OPTIONS });
    const data = createDataManager(db, state, ui);
    const events = createEventManager(config.elements, state, ui, data, { LONG_PRESS_DURATION, GENDER_OPTIONS });

    // 3. 暴露公共接口
    return {
        initializeApp: data.initializeApp,
        loadProfileData: data.loadProfileData,
        addNewProfile: data.addNewProfile,
        openSwitcherSettingsModal: ui.openSwitcherSettingsModal,
        getDbKey: (key) => state.getDbKey(key),
        getProfileData: () => state.profileData,
        setProfileData: (newData) => { 
            state.profileData = newData; 
            // 确保排序后能立即保存
            data.dbStorage.setItem(state.getDbKey('profileData'), newData);
        },
        bindSharedEvents: events.bindSharedEvents,
        bindUiSpecificEvents: events.bindUiSpecificEvents
    };
}