// ============ 静态数据：30 支球队（中文名/英文名/缩写/分区）+ 拟真姓名库 ============
import type { Pos } from './types';

export interface TeamInfo {
  name: string;
  city: string;
  en: string;
  abbr: string;
  conf: 'EAST' | 'WEST';
}

// 顺序即固定 ID 0..29（东部 0-14，西部 15-29）
export const TEAMS: TeamInfo[] = [
  { name: '凯尔特人', city: '波士顿', en: 'Celtics', abbr: 'BOS', conf: 'EAST' },
  { name: '尼克斯', city: '纽约', en: 'Knicks', abbr: 'NYK', conf: 'EAST' },
  { name: '76人', city: '费城', en: '76ers', abbr: 'PHI', conf: 'EAST' },
  { name: '猛龙', city: '多伦多', en: 'Raptors', abbr: 'TOR', conf: 'EAST' },
  { name: '篮网', city: '布鲁克林', en: 'Nets', abbr: 'BKN', conf: 'EAST' },
  { name: '雄鹿', city: '密尔沃基', en: 'Bucks', abbr: 'MIL', conf: 'EAST' },
  { name: '骑士', city: '克里夫兰', en: 'Cavaliers', abbr: 'CLE', conf: 'EAST' },
  { name: '步行者', city: '印第安纳', en: 'Pacers', abbr: 'IND', conf: 'EAST' },
  { name: '公牛', city: '芝加哥', en: 'Bulls', abbr: 'CHI', conf: 'EAST' },
  { name: '活塞', city: '底特律', en: 'Pistons', abbr: 'DET', conf: 'EAST' },
  { name: '热火', city: '迈阿密', en: 'Heat', abbr: 'MIA', conf: 'EAST' },
  { name: '魔术', city: '奥兰多', en: 'Magic', abbr: 'ORL', conf: 'EAST' },
  { name: '老鹰', city: '亚特兰大', en: 'Hawks', abbr: 'ATL', conf: 'EAST' },
  { name: '黄蜂', city: '夏洛特', en: 'Hornets', abbr: 'CHA', conf: 'EAST' },
  { name: '奇才', city: '华盛顿', en: 'Wizards', abbr: 'WAS', conf: 'EAST' },
  { name: '掘金', city: '丹佛', en: 'Nuggets', abbr: 'DEN', conf: 'WEST' },
  { name: '森林狼', city: '明尼苏达', en: 'Timberwolves', abbr: 'MIN', conf: 'WEST' },
  { name: '雷霆', city: '俄克拉荷马城', en: 'Thunder', abbr: 'OKC', conf: 'WEST' },
  { name: '开拓者', city: '波特兰', en: 'Trail Blazers', abbr: 'POR', conf: 'WEST' },
  { name: '爵士', city: '犹他', en: 'Jazz', abbr: 'UTA', conf: 'WEST' },
  { name: '勇士', city: '金州', en: 'Warriors', abbr: 'GSW', conf: 'WEST' },
  { name: '快船', city: '洛杉矶', en: 'Clippers', abbr: 'LAC', conf: 'WEST' },
  { name: '湖人', city: '洛杉矶', en: 'Lakers', abbr: 'LAL', conf: 'WEST' },
  { name: '太阳', city: '菲尼克斯', en: 'Suns', abbr: 'PHX', conf: 'WEST' },
  { name: '国王', city: '萨克拉门托', en: 'Kings', abbr: 'SAC', conf: 'WEST' },
  { name: '独行侠', city: '达拉斯', en: 'Mavericks', abbr: 'DAL', conf: 'WEST' },
  { name: '火箭', city: '休斯顿', en: 'Rockets', abbr: 'HOU', conf: 'WEST' },
  { name: '灰熊', city: '孟菲斯', en: 'Grizzlies', abbr: 'MEM', conf: 'WEST' },
  { name: '鹈鹕', city: '新奥尔良', en: 'Pelicans', abbr: 'NOP', conf: 'WEST' },
  { name: '马刺', city: '圣安东尼奥', en: 'Spurs', abbr: 'SAS', conf: 'WEST' },
];

export const POS_ORDER: Pos[] = ['PG', 'SG', 'SF', 'PF', 'C'];

// ---------- 中文姓名池（生成虚构球员用；v0.3.1 全中文） ----------
export const FIRST_NAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
  '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆', '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史',
  '顾', '侯', '邵', '孟', '龙', '万', '段', '雷', '钱', '汤', '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文',
];

export const LAST_NAMES = [
  '子轩', '浩然', '宇轩', '一诺', '子涵', '欣怡', '梓涵', '雨桐', '诗涵', '佳琪',
  '欣妍', '梦琪', '思远', '博文', '志强', '俊杰', '天佑', '宇航', '星辰', '立群',
  '俊峰', '家豪', '永强', '佳明', '雪峰', '宏达', '志明', '晓东', '建华', '文博',
  '世杰', '泽宇', '明轩', '晨曦', '远航', '晨阳', '景行', '知远', '俊驰', '锦程',
  '嘉懿', '鹏程', '乐山', '子墨', '昊然', '明哲', '德辉', '承志', '修远', '亦凡',
  '雨泽', '皓轩', '子骞', '正豪', '昌茂', '茂才', '睿渊', '达强', '博涛', '君昊',
  '弘文', '晋鹏', '越泽', '修洁', '伟诚', '立诚', '邦泰', '鹏煊', '智渊', '泰宇',
  '嘉熙', '承恩', '峻熙', '弘昌', '志泽', '楷瑞', '瑾瑜', '煜城', '懿轩', '烨磊',
  '天翊', '文昊', '博超', '振豪', '建辉', '云舟', '若飞', '松柏', '思聪', '问天',
  '凌风', '伟', '军', '洋', '勇', '杰', '涛', '明', '超', '平', '刚', '强', '辉', '健', '斌', '鑫', '磊', '伟东', '志豪', '国栋',
];

// 由位置生成偏好的中文名长度风格没有限制，直接组合即可。
export function makeName(first: string, last: string): string {
  return first + last;
}

// ---------- v2.1 英文姓名池（选秀新秀：美国 70% / 其他 25% 用英文名；中国 5% 用中文名） ----------
export const FIRST_EN = [
  'Jalen', 'Tyrese', 'Ja', 'Luka', 'Devin', 'Shai', 'Anthony', 'Trae', 'Zion', 'Paolo',
  'Jayson', 'Jaylen', 'Evan', 'Chet', 'Amen', 'Ausar', 'Brandon', 'Cam', 'Cade', 'Collin',
  'Dereck', 'Desmond', 'Donovan', 'Franz', 'Grant', 'Isaiah', 'Jabari', 'Keegan', 'Mark', 'Miles',
  'Nicolas', 'Oscar', 'Quentin', 'Reed', 'Scoot', 'Tari', 'Tyrese', 'Victor', 'Walker', 'Xavier',
];
export const LAST_EN = [
  'Anderson', 'Bailey', 'Banks', 'Barnes', 'Bates', 'Bell', 'Booker', 'Brooks', 'Carter', 'Clarke',
  'Cole', 'Collins', 'Crawford', 'Daniels', 'Davis', 'Ellis', 'Evans', 'Foster', 'Franklin', 'Garrett',
  'Gibson', 'Grant', 'Griffin', 'Hall', 'Harris', 'Hayes', 'Hendricks', 'Howard', 'Hunter', 'Jackson',
  'James', 'Jenkins', 'Johnson', 'Jones', 'Keller', 'King', 'Lopez', 'Martin', 'Miller', 'Mitchell',
  'Moore', 'Morgan', 'Morris', 'Murphy', 'Nelson', 'Owens', 'Parker', 'Perry', 'Porter', 'Powell',
  'Ramsey', 'Reed', 'Reese', 'Rice', 'Richards', 'Roberts', 'Robinson', 'Ross', 'Russell', 'Sanders',
  'Spencer', 'Stewart', 'Stone', 'Taylor', 'Terry', 'Thomas', 'Tucker', 'Vaughn', 'Walker', 'Ward',
  'Warren', 'Watson', 'Weaver', 'Webb', 'Wells', 'Williams', 'Wilson', 'Wright', 'Young', 'Zimmerman',
];
