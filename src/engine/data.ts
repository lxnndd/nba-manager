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

// ---------- v2.3.0 国际球员姓名池（选秀：60 美国 / 3 中国 / 17 其他国家） ----------
// 规则：其他国家按「具体国家」+ 该国真实姓名风格生成，再译为中文常见译名。
// nameOrder：'west' = 名·姓（欧美/非洲/拉美），'east' = 姓+名（中日韩）。
export interface NationPool {
  nation: string;                       // 中文国名（显示用；不使用"欧洲/南美"这类地区名）
  nameOrder: 'west' | 'east';
  first: [string, string][];            // [原文, 中文译名]
  last: [string, string][];
}

export const NATION_POOLS: NationPool[] = [
  {
    nation: '法国', nameOrder: 'west',
    first: [['Victor', '维克托'], ['Evan', '埃文'], ['Killian', '基利安'], ['Théo', '泰奥'], ['Ousmane', '乌斯曼'], ['Rudy', '鲁迪'], ['Guerschon', '盖尔雄'], ['Nicolas', '尼古拉'], ['Ismaël', '伊斯梅尔'], ['Moussa', '穆萨']],
    last: [['Wembanyama', '文班亚马'], ['Fournier', '富尼耶'], ['Gobert', '戈贝尔'], ['Batum', '巴图姆'], ['Dieng', '迪昂'], ['Yabusele', '亚布塞莱'], ['Coulibaly', '库利巴利'], ['Hayes', '海斯'], ['Cissoko', '西索科'], ['Traoré', '特拉奥雷']],
  },
  {
    nation: '塞尔维亚', nameOrder: 'west',
    first: [['Nikola', '尼古拉'], ['Bogdan', '博格丹'], ['Nemanja', '内马尼亚'], ['Marko', '马尔科'], ['Stefan', '斯特凡'], ['Aleksa', '阿莱克萨'], ['Vasilije', '瓦西里耶'], ['Ognjen', '奥格年'], ['Filip', '菲利普'], ['Luka', '卢卡']],
    last: [['Jokić', '约基奇'], ['Bogdanović', '博格达诺维奇'], ['Marjanović', '马里亚诺维奇'], ['Micić', '米契奇'], ['Petrović', '彼得罗维奇'], ['Topić', '托皮奇'], ['Jović', '约维奇'], ['Pokusevski', '波库舍夫斯基'], ['Đurišić', '久里希奇'], ['Ilić', '伊利奇']],
  },
  {
    nation: '西班牙', nameOrder: 'west',
    first: [['Ricky', '里基'], ['Juan', '胡安'], ['Sergio', '塞尔吉奥'], ['Usman', '乌斯曼'], ['Willy', '威利'], ['Alejandro', '亚历杭德罗'], ['Santi', '桑蒂'], ['Izan', '伊桑'], ['Alberto', '阿尔贝托'], ['Pablo', '巴勃罗']],
    last: [['Rubio', '卢比奥'], ['Hernangómez', '埃尔南戈麦斯'], ['Fernández', '费尔南德斯'], ['Garuba', '加鲁巴'], ['Aldama', '阿尔达马'], ['Abrines', '阿布里内斯'], ['Brizuela', '布里苏埃拉'], ['Núñez', '努涅斯'], ['Díaz', '迪亚斯'], ['García', '加西亚']],
  },
  {
    nation: '德国', nameOrder: 'west',
    first: [['Dennis', '丹尼斯'], ['Franz', '弗朗茨'], ['Moritz', '莫里茨'], ['Maxi', '马克西'], ['Daniel', '丹尼尔'], ['Isaiah', '伊赛亚'], ['Nick', '尼克'], ['Tristan', '特里斯坦'], ['Jonas', '约纳斯'], ['Leon', '莱昂']],
    last: [['Schröder', '施罗德'], ['Wagner', '瓦格纳'], ['Kleber', '克莱贝尔'], ['Theis', '泰斯'], ['Bonga', '邦加'], ['Da Silva', '达席尔瓦'], ['Obst', '奥布斯特'], ['Voigtmann', '沃格特曼'], ['Hartenstein', '哈滕施泰因'], ['Kratzer', '克拉策']],
  },
  {
    nation: '澳大利亚', nameOrder: 'west',
    first: [['Josh', '乔什'], ['Patty', '帕蒂'], ['Joe', '乔'], ['Dyson', '戴森'], ['Matisse', '马蒂斯'], ['Jock', '乔克'], ['Dante', '丹特'], ['Andrew', '安德鲁'], ['Johnny', '约翰尼'], ['Tyrese', '泰瑞斯']],
    last: [['Giddey', '吉迪'], ['Mills', '米尔斯'], ['Ingles', '英格尔斯'], ['Daniels', '丹尼尔斯'], ['Thybulle', '蒂布尔'], ['Landale', '兰代尔'], ['Exum', '埃克萨姆'], ['Green', '格林'], ['Furphy', '弗菲'], ['Proctor', '普罗克特']],
  },
  {
    nation: '加拿大', nameOrder: 'west',
    first: [['Andrew', '安德鲁'], ['Jamal', '贾马尔'], ['RJ', '阿尔杰'], ['Shai', '谢伊'], ['Dillon', '狄龙'], ['Bennedict', '贝内迪克特'], ['Cory', '科里'], ['Trey', '特雷'], ['Shaedon', '谢登'], ['Olivier', '奥利维耶']],
    last: [['Wiggins', '维金斯'], ['Murray', '穆雷'], ['Barrett', '巴雷特'], ['Gilgeous-Alexander', '吉尔杰斯-亚历山大'], ['Brooks', '布鲁克斯'], ['Mathurin', '马图林'], ['Joseph', '约瑟夫'], ['Lyles', '莱尔斯'], ['Sharpe', '夏普'], ['Maxence-Prosper', '马克桑斯-普罗斯珀']],
  },
  {
    nation: '尼日利亚', nameOrder: 'west',
    first: [['Akeem', '阿基姆'], ['Chinedu', '奇内杜'], ['Josh', '乔什'], ['Precious', '普雷舍斯'], ['Charles', '查尔斯'], ['Ike', '艾克'], ['KZ', '凯齐'], ['Chuma', '丘马'], ['Obi', '奥比'], ['Emeka', '埃梅卡']],
    last: [['Olajuwon', '奥拉朱旺'], ['Okongwu', '奥孔古'], ['Achiuwa', '阿丘瓦'], ['Bassey', '巴西'], ['Nwora', '恩沃拉'], ['Anunoby', '阿努诺比'], ['Okogie', '奥科吉'], ['Metu', '梅图'], ['Edey', '伊迪'], ['Nnaji', '恩纳吉']],
  },
  {
    nation: '南苏丹', nameOrder: 'west',
    first: [['Wenyen', '温延'], ['Bol', '波尔'], ['Thon', '索恩'], ['Duop', '杜奥普'], ['Khaman', '卡曼'], ['Mangok', '曼戈克'], ['Junior', '朱尼尔'], ['Peter', '彼得'], ['Deng', '邓'], ['Kuol', '库奥尔']],
    last: [['Gabriel', '加布里埃尔'], ['Maker', '梅克'], ['Reath', '里斯'], ['Maluach', '马卢阿奇'], ['Mathiang', '马蒂昂'], ['Jok', '乔克'], ['Deng', '邓'], ['Atu', '阿图'], ['Bior', '比奥尔'], ['Lual', '卢阿尔']],
  },
  {
    nation: '喀麦隆', nameOrder: 'west',
    first: [['Pascal', '帕斯卡尔'], ['Joel', '乔尔'], ['Christian', '克里斯蒂安'], ['Yves', '伊夫'], ['Ulrich', '乌尔里希'], ['Landry', '兰德里'], ['Sam', '萨姆'], ['Charles', '查尔斯'], ['Roger', '罗杰'], ['Jerry', '杰里']],
    last: [['Siakam', '西亚卡姆'], ['Embiid', '恩比德'], ['Koloko', '科洛科'], ['Missi', '米西'], ['Chomche', '乔姆切'], ['Doumbia', '敦比亚'], ['Tchoua', '乔阿'], ['Essengue', '埃森格'], ['Biyombo', '比永博'], ['Moneke', '莫内克']],
  },
  {
    nation: '立陶宛', nameOrder: 'west',
    first: [['Domantas', '多曼塔斯'], ['Jonas', '约纳斯'], ['Rokas', '罗卡斯'], ['Mindaugas', '明道加斯'], ['Deividas', '戴维达斯'], ['Arnas', '阿尔纳斯'], ['Marius', '马里乌斯'], ['Tomas', '托马斯'], ['Matas', '马塔斯'], ['Kasparas', '卡斯帕拉斯']],
    last: [['Sabonis', '萨博尼斯'], ['Valančiūnas', '瓦兰丘纳斯'], ['Jokubaitis', '约库拜蒂斯'], ['Kuzminskas', '库兹明斯卡斯'], ['Sirvydis', '西尔维迪斯'], ['Butkevičius', '布特克维丘斯'], ['Normantas', '诺尔曼塔斯'], ['Giedraitis', '吉德拉伊蒂斯'], ['Buzelis', '布泽利斯'], ['Jakucionis', '雅库乔尼斯']],
  },
  {
    nation: '拉脱维亚', nameOrder: 'west',
    first: [['Kristaps', '克里斯塔普斯'], ['Dāvis', '戴维斯'], ['Rodions', '罗迪翁斯'], ['Anžejs', '安热伊斯'], ['Rolands', '罗兰兹'], ['Artūrs', '阿图尔斯'], ['Klavs', '克拉夫斯'], ['Mareks', '马雷克斯'], ['Rihards', '里哈兹'], ['Andrejs', '安德烈斯']],
    last: [['Porziņģis', '波尔津吉斯'], ['Bertāns', '贝尔坦斯'], ['Kurucs', '库鲁茨'], ['Pasečņiks', '帕塞奇尼克斯'], ['Smits', '斯米茨'], ['Zagars', '扎加尔斯'], ['Čavars', '察瓦尔斯'], ['Laksa', '拉克萨'], ['Lomažs', '洛马兹'], ['Timma', '蒂马']],
  },
  {
    nation: '土耳其', nameOrder: 'west',
    first: [['Alperen', '阿尔佩伦'], ['Cedi', '杰迪'], ['Furkan', '富尔坎'], ['Ömer', '奥梅尔'], ['Sertaç', '塞尔塔奇'], ['Yiğit', '伊伊特'], ['Berk', '贝尔克'], ['Onuralp', '奥努拉尔普'], ['Adem', '阿德姆'], ['Kerem', '凯雷姆']],
    last: [['Şengün', '申京'], ['Osman', '奥斯曼'], ['Korkmaz', '科尔克马兹'], ['Yurtseven', '尤尔特塞文'], ['Şanlı', '桑利'], ['Arslan', '阿尔斯兰'], ['Uğurlu', '乌古尔卢'], ['Bitim', '比蒂姆'], ['Bona', '博纳'], ['Tunca', '通贾']],
  },
  {
    nation: '希腊', nameOrder: 'west',
    first: [['Giannis', '扬尼斯'], ['Thanasis', '萨纳西斯'], ['Kostas', '科斯塔斯'], ['Nikos', '尼科斯'], ['Lefteris', '莱夫特里斯'], ['Vasilis', '瓦西利斯'], ['Dimitris', '季米特里斯'], ['Panagiotis', '帕纳约蒂斯'], ['Alexandros', '亚历山德罗斯'], ['Ioannis', '约安尼斯']],
    last: [['Antetokounmpo', '阿德托昆博'], ['Calathes', '卡拉西斯'], ['Sloukas', '斯卢卡斯'], ['Papagiannis', '帕帕扬尼斯'], ['Dorsey', '多尔西'], ['Mantzaris', '曼察里斯'], ['Larentzakis', '拉伦察基斯'], ['Mitoglou', '米托格卢'], ['Papapetrou', '帕帕佩特鲁'], ['Rogkavopoulos', '罗卡沃普洛斯']],
  },
  {
    nation: '斯洛文尼亚', nameOrder: 'west',
    first: [['Luka', '卢卡'], ['Goran', '戈兰'], ['Zoran', '佐兰'], ['Vlatko', '弗拉特科'], ['Klemen', '克莱门'], ['Jakob', '雅各布'], ['Jaka', '雅卡'], ['Edo', '埃多'], ['Žiga', '日加'], ['Gregor', '格雷戈尔']],
    last: [['Dončić', '东契奇'], ['Dragić', '德拉季奇'], ['Čančar', '坎卡尔'], ['Prepelic', '普雷佩利奇'], ['Blazic', '布拉日奇'], ['Cebasek', '切巴塞克'], ['Klobucar', '克洛布查尔'], ['Muric', '穆里奇'], ['Samar', '萨马尔'], ['Dimec', '迪梅茨']],
  },
  {
    nation: '克罗地亚', nameOrder: 'west',
    first: [['Dario', '达里奥'], ['Bojan', '博扬'], ['Ivica', '伊维察'], ['Mario', '马里奥'], ['Ante', '安特'], ['Karlo', '卡洛'], ['Roko', '罗科'], ['Toni', '托尼'], ['Luka', '卢卡'], ['Josip', '约西普']],
    last: [['Šarić', '萨里奇'], ['Bogdanović', '博格达诺维奇'], ['Zubac', '祖巴茨'], ['Hezonja', '赫佐尼亚'], ['Žižić', '日兹奇'], ['Matković', '马特科维奇'], ['Prkačin', '普尔卡钦'], ['Simonović', '西莫诺维奇'], ['Bender', '本德尔'], ['Nakić', '纳基奇']],
  },
  {
    nation: '意大利', nameOrder: 'west',
    first: [['Danilo', '达尼洛'], ['Marco', '马尔科'], ['Nicolò', '尼古洛'], ['Simone', '西蒙内'], ['Matteo', '马泰奥'], ['Alessandro', '亚历山德罗'], ['Luca', '卢卡'], ['Giampaolo', '詹保罗'], ['Gabriele', '加布里埃莱'], ['Tommaso', '托马索']],
    last: [['Gallinari', '加里纳利'], ['Belinelli', '贝里内利'], ['Melli', '梅利'], ['Fontecchio', '丰泰基奥'], ['Spagnolo', '斯帕尼奥洛'], ['Procida', '普罗奇达'], ['Ricci', '里奇'], ['Tessitori', '泰西托雷'], ['Diop', '迪奥普'], ['Severini', '塞韦里尼']],
  },
  {
    nation: '日本', nameOrder: 'east',
    first: [['Rui', '塁'], ['Yuta', '雄太'], ['Yuki', '勇树'], ['Keisei', '庆成'], ['Makoto', '诚'], ['Hirotaka', '广贵'], ['Ren', '莲'], ['Sota', '飒太'], ['Akira', '彰'], ['Kaito', '海斗']],
    last: [['Hachimura', '八村'], ['Watanabe', '渡边'], ['Tominaga', '富永'], ['Baba', '马场'], ['Yoshii', '吉井'], ['Kawamura', '河村'], ['Tanaka', '田中'], ['Sato', '佐藤'], ['Yamamoto', '山本'], ['Kobayashi', '小林']],
  },
  {
    nation: '韩国', nameOrder: 'east',
    first: [['Minsoo', '敏洙'], ['Junho', '俊浩'], ['Sunghoon', '成勋'], ['Donghyun', '东贤'], ['Jaehwan', '在焕'], ['Hyunwoo', '贤宇'], ['Jisoo', '智秀'], ['Taeyang', '太阳'], ['Seunghyun', '承贤'], ['Woong', '雄']],
    last: [['Kim', '金'], ['Lee', '李'], ['Park', '朴'], ['Choi', '崔'], ['Jung', '郑'], ['Kang', '姜'], ['Cho', '赵'], ['Yoon', '尹'], ['Jang', '张'], ['Lim', '林']],
  },
  {
    nation: '菲律宾', nameOrder: 'west',
    first: [['Jordan', '乔丹'], ['Kai', '凯'], ['Jalen', '杰伦'], ['Carl', '卡尔'], ['Dwight', '德怀特'], ['Roger', '罗杰'], ['Kevin', '凯文'], ['Thirdy', '瑟迪'], ['Quentin', '昆汀'], ['Remy', '雷米']],
    last: [['Clarkson', '克拉克森'], ['Sotto', '索托'], ['Green', '格林'], ['Tamayo', '塔马约'], ['Ramos', '拉莫斯'], ['Abando', '阿班多'], ['Quiambao', '基安包'], ['Edu', '埃杜'], ['Martin', '马丁'], ['Lopez', '洛佩斯']],
  },
  {
    nation: '新西兰', nameOrder: 'west',
    first: [['Steven', '史蒂文'], ['Sean', '肖恩'], ['Finn', '芬恩'], ['Tohi', '托希'], ['Rob', '罗布'], ['Izayah', '伊扎亚'], ['Sam', '萨姆'], ['Dan', '丹'], ['Mojave', '莫哈维'], ['Tyrell', '泰瑞尔']],
    last: [['Adams', '亚当斯'], ['Marks', '马克斯'], ['Delany', '德拉尼'], ['Smith', '史密斯'], ["Le'Afa", '勒阿法'], ['Fotu', '福图'], ['Waardenburg', '瓦尔登堡'], ['King', '金'], ['Hunt', '亨特'], ['Te Rangi', '特兰吉']],
  },
  {
    nation: '格鲁吉亚', nameOrder: 'west',
    first: [['Giorgi', '乔尔吉'], ['Sandro', '桑德罗'], ['Tornike', '托尔尼克'], ['Goga', '戈加'], ['Beka', '贝卡'], ['Duda', '杜达'], ['Luka', '卢卡'], ['Rati', '拉蒂'], ['Nikoloz', '尼科洛兹'], ['Levan', '列万']],
    last: [['Bitadze', '比塔泽'], ['Mamukelashvili', '马穆克拉什维利'], ['Shengelia', '申格利亚'], ['Andronikashvili', '安德罗尼卡什维利'], ['Sanadze', '萨纳泽'], ['Tsintsadze', '钦察泽'], ['Burjanadze', '布尔贾纳泽'], ['Jintcharadze', '金查拉泽'], ['Shermadini', '谢尔马迪尼'], ['Kvesitadze', '克韦西塔泽']],
  },
];
// ---------- 英文姓名池（美国新秀用）+ v2.5.0 中文译名对照 ----------
// v2.5.0：新秀名字**全部汉化**——美国新秀也用中文译名显示（如 Jalen Carter → 杰伦·卡特）；
// 英文原值仍用于内部防重与唯一性校验。
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

// v2.5.0：英文名 → 中文译名映射（让美国新秀也显示中文名）
export const FIRST_EN_ZH: Record<string, string> = {
  Jalen: '杰伦', Tyrese: '泰瑞斯', Ja: '贾', Luka: '卢卡', Devin: '德文', Shai: '谢伊',
  Anthony: '安东尼', Trae: '特雷', Zion: '锡安', Paolo: '保罗', Jayson: '杰森', Jaylen: '杰伦',
  Evan: '埃文', Chet: '切特', Amen: '阿门', Ausar: '奥萨尔', Brandon: '布兰登', Cam: '卡姆',
  Cade: '凯德', Collin: '科林', Dereck: '德里克', Desmond: '德斯蒙德', Donovan: '多诺万',
  Franz: '弗朗茨', Grant: '格兰特', Isaiah: '以赛亚', Jabari: '贾巴里', Keegan: '基根',
  Mark: '马克', Miles: '迈尔斯', Nicolas: '尼古拉', Oscar: '奥斯卡', Quentin: '昆汀',
  Reed: '里德', Scoot: '斯库特', Tari: '塔里', Victor: '维克托', Walker: '沃克', Xavier: '泽维尔',
};

export const LAST_EN_ZH: Record<string, string> = {
  Anderson: '安德森', Bailey: '贝利', Banks: '班克斯', Barnes: '巴恩斯', Bates: '贝茨', Bell: '贝尔',
  Booker: '布克', Brooks: '布鲁克斯', Carter: '卡特', Clarke: '克拉克', Cole: '科尔',
  Collins: '柯林斯', Crawford: '克劳福德', Daniels: '丹尼尔斯', Davis: '戴维斯', Ellis: '埃利斯',
  Evans: '埃文斯', Foster: '福斯特', Franklin: '富兰克林', Garrett: '加勒特', Gibson: '吉布森',
  Grant: '格兰特', Griffin: '格里芬', Hall: '霍尔', Harris: '哈里斯', Hayes: '海斯',
  Hendricks: '亨德里克斯', Howard: '霍华德', Hunter: '亨特', Jackson: '杰克逊', James: '詹姆斯',
  Jenkins: '詹金斯', Johnson: '约翰逊', Jones: '琼斯', Keller: '凯勒', King: '金', Lopez: '洛佩斯',
  Martin: '马丁', Miller: '米勒', Mitchell: '米切尔', Moore: '摩尔', Morgan: '摩根',
  Morris: '莫里斯', Murphy: '墨菲', Nelson: '尼尔森', Owens: '欧文斯', Parker: '帕克',
  Perry: '佩里', Porter: '波特', Powell: '鲍威尔', Ramsey: '拉姆齐', Reed: '里德', Reese: '里斯',
  Rice: '赖斯', Richards: '理查兹', Roberts: '罗伯茨', Robinson: '罗宾逊', Ross: '罗斯',
  Russell: '拉塞尔', Sanders: '桑德斯', Spencer: '斯宾塞', Stewart: '斯图尔特', Stone: '斯通',
  Taylor: '泰勒', Terry: '特里', Thomas: '托马斯', Tucker: '塔克', Vaughn: '沃恩', Walker: '沃克',
  Ward: '沃德', Warren: '沃伦', Watson: '沃森', Weaver: '韦弗', Webb: '韦布', Wells: '韦尔斯',
  Williams: '威廉姆斯', Wilson: '威尔逊', Wright: '赖特', Young: '杨', Zimmerman: '齐默尔曼',
};

// 英文姓名 → 中文译名（"名·姓"）；用于新秀汉化与旧存档迁移
export function enNameToZh(en: string): string {
  const parts = String(en).replace(/ Jr\.$/, '').split(' ');
  const f = parts[0] ?? '';
  const l = parts.slice(1).join(' ');
  const fz = FIRST_EN_ZH[f];
  const lz = LAST_EN_ZH[l];
  if (!fz && !lz) return en; // 两边都认不出（真实球员名等）→ 原样返回，避免误改
  return `${fz ?? f}·${lz ?? l}`;
}
