/**
 * 便签管理器
 * 管理便签的增删改查和持久化存储
 */
export class StickyNoteManager {
  constructor() {
    this.notes = [];
    this.colors = [
      { id: 'yellow', bg: '#ffffc8', name: '黄色' },
      { id: 'blue', bg: '#c8e6ff', name: '蓝色' },
      { id: 'green', bg: '#c8ffc8', name: '绿色' },
      { id: 'pink', bg: '#ffc8dc', name: '粉色' },
      { id: 'purple', bg: '#e6c8ff', name: '紫色' },
      { id: 'orange', bg: '#ffdcb4', name: '橙色' }
    ];
    this.STORAGE_KEY = 'stickyNotes';
  }

  /**
   * 初始化，加载保存的便签
   */
  async init() {
    await this.loadNotes();
  }

  /**
   * 从存储中加载便签
   */
  async loadNotes() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      this.notes = result[this.STORAGE_KEY] || [];
      
      // 确保每个便签都有必要的字段
      this.notes = this.notes.map(note => ({
        id: note.id || Date.now().toString(),
        title: note.title || '',
        content: note.content || '',
        color: note.color || 'yellow',
        createdAt: note.createdAt || Date.now(),
        updatedAt: note.updatedAt || Date.now()
      }));
    } catch (error) {
      console.error('加载便签失败:', error);
      this.notes = [];
    }
  }

  /**
   * 保存便签到存储
   */
  async saveNotes() {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: this.notes,
        lastLocalModify: Date.now()
      });
      return true;
    } catch (error) {
      console.error('保存便签失败:', error);
      return false;
    }
  }

  /**
   * 创建新便签
   * @param {Object} noteData - 便签数据
   * @returns {Object} 创建的便签
   */
  async createNote(noteData = {}) {
    const newNote = {
      id: Date.now().toString(),
      title: noteData.title || '',
      content: noteData.content || '',
      color: noteData.color || 'yellow',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.notes.unshift(newNote); // 添加到开头
    await this.saveNotes();
    return newNote;
  }

  /**
   * 更新便签
   * @param {string} id - 便签ID
   * @param {Object} updates - 更新的字段
   * @returns {boolean} 是否成功
   */
  async updateNote(id, updates) {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) return false;

    this.notes[index] = {
      ...this.notes[index],
      ...updates,
      updatedAt: Date.now()
    };

    await this.saveNotes();
    return true;
  }

  /**
   * 删除便签
   * @param {string} id - 便签ID
   * @returns {boolean} 是否成功
   */
  async deleteNote(id) {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) return false;

    this.notes.splice(index, 1);
    await this.saveNotes();
    return true;
  }

  /**
   * 获取所有便签
   * @returns {Array} 便签列表
   */
  getAllNotes() {
    return [...this.notes];
  }

  /**
   * 获取单个便签
   * @param {string} id - 便签ID
   * @returns {Object|null} 便签对象
   */
  getNote(id) {
    return this.notes.find(n => n.id === id) || null;
  }

  /**
   * 获取颜色列表
   * @returns {Array} 颜色列表
   */
  getColors() {
    return this.colors;
  }

  /**
   * 重新排序便签
   * @param {string} draggedId - 被拖拽的便签ID
   * @param {string} targetId - 目标位置的便签ID
   * @returns {boolean} 是否成功
   */
  async reorderNotes(draggedId, targetId) {
    const draggedIndex = this.notes.findIndex(n => n.id === draggedId);
    const targetIndex = this.notes.findIndex(n => n.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return false;
    
    const [draggedNote] = this.notes.splice(draggedIndex, 1);
    this.notes.splice(targetIndex, 0, draggedNote);
    
    await this.saveNotes();
    return true;
  }

  /**
   * 导出便签数据（用于备份）
   * @returns {Array} 便签数据
   */
  exportData() {
    return this.notes;
  }

  /**
   * 导入便签数据
   * @param {Array} notes - 便签数据
   */
  async importData(notes) {
    if (Array.isArray(notes)) {
      this.notes = notes;
      await this.saveNotes();
      return true;
    }
    return false;
  }
}
