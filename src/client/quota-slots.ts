/**
 * 侧栏底座与主内容区槽位类型扩展声明。
 *
 * @module dsh-trae-connect/client/quota-slots
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** 布局中心面板槽位 */
    'main': { kind: 'keyed'; scope: 'root' }
    /** 侧栏底部操作卡片列表槽位 */
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: SidebarFooterActionOwnerProps }
  }
}

/** 侧边栏底部操作区宿主属性 */
export interface SidebarFooterActionOwnerProps {
  /** 侧栏是否为宽屏展开模式（false 为 56px 紧凑收起模式） */
  wide: boolean
}
