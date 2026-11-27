export interface Leader {
  id: string;
  name: string;
  district: string;
  state: string;
  score: number;
  tasks: number;
  farmers: number;
  me?: boolean;
}

export type Scope = 'state' | 'national';
export type Period = 'month' | 'all';

const ME = { id: 'KD00001', name: 'Sumita Kumari', district: 'Buldhana', state: 'Maharashtra', me: true };

const mh = (id: string, name: string, district: string, score: number, tasks: number, farmers: number): Leader => ({ id, name, district, state: 'Maharashtra', score, tasks, farmers });
const nat = (id: string, name: string, district: string, state: string, score: number, tasks: number, farmers: number): Leader => ({ id, name, district, state, score, tasks, farmers });

/** Sample rankings. Scores come from Kisani Urjaa; the app only shows them. */
const BOARDS: Record<Scope, Record<Period, Leader[]>> = {
  state: {
    month: [mh('KD00118', 'Priyanka Deshmukh', 'Akola', 962, 14, 38), mh('KD00087', 'Savita Gaikwad', 'Amravati', 941, 13, 35), mh('KD00142', 'Jyoti Kharat', 'Washim', 918, 12, 31), mh('KD00063', 'Asha Telang', 'Buldhana', 884, 12, 29), mh('KD00151', 'Mangal Sonone', 'Yavatmal', 861, 11, 27), mh('KD00094', 'Rupali Chavan', 'Jalna', 839, 11, 26), { ...ME, score: 812, tasks: 10, farmers: 14 }, mh('KD00077', 'Kalpana Wath', 'Akola', 798, 10, 22), mh('KD00121', 'Sangita Dhole', 'Amravati', 771, 9, 21), mh('KD00134', 'Vaishali Kute', 'Buldhana', 745, 9, 19)],
    all: [mh('KD00087', 'Savita Gaikwad', 'Amravati', 9810, 141, 212), mh('KD00118', 'Priyanka Deshmukh', 'Akola', 9544, 136, 198), mh('KD00063', 'Asha Telang', 'Buldhana', 9102, 129, 187), { ...ME, score: 8870, tasks: 122, farmers: 14 }, mh('KD00142', 'Jyoti Kharat', 'Washim', 8611, 118, 170), mh('KD00094', 'Rupali Chavan', 'Jalna', 8423, 115, 166), mh('KD00151', 'Mangal Sonone', 'Yavatmal', 8190, 110, 158), mh('KD00077', 'Kalpana Wath', 'Akola', 7952, 104, 149)],
  },
  national: {
    month: [nat('KD02211', 'Gurpreet Kaur', 'Ludhiana', 'Punjab', 1188, 17, 52), nat('KD03104', 'Rinku Devi', 'Karnal', 'Haryana', 1121, 16, 47), nat('KD01877', 'Lakshmi Reddy', 'Nizamabad', 'Telangana', 1094, 15, 44), nat('KD02390', 'Manpreet Sandhu', 'Patiala', 'Punjab', 1050, 15, 41), nat('KD01412', 'Sarita Yadav', 'Varanasi', 'Uttar Pradesh', 1013, 14, 39), mh('KD00118', 'Priyanka Deshmukh', 'Akola', 962, 14, 38), nat('KD02902', 'Puja Kumari', 'Gaya', 'Bihar', 955, 13, 37), mh('KD00087', 'Savita Gaikwad', 'Amravati', 941, 13, 35), nat('KD03321', 'Kiran Bala', 'Kurukshetra', 'Haryana', 930, 13, 34), nat('KD01766', 'Sasmita Behera', 'Cuttack', 'Odisha', 922, 12, 33)],
    all: [nat('KD02211', 'Gurpreet Kaur', 'Ludhiana', 'Punjab', 12480, 171, 280), nat('KD03104', 'Rinku Devi', 'Karnal', 'Haryana', 11912, 162, 261), nat('KD01877', 'Lakshmi Reddy', 'Nizamabad', 'Telangana', 11540, 158, 244), nat('KD02390', 'Manpreet Sandhu', 'Patiala', 'Punjab', 11002, 150, 236), mh('KD00087', 'Savita Gaikwad', 'Amravati', 9810, 141, 212), nat('KD01412', 'Sarita Yadav', 'Varanasi', 'Uttar Pradesh', 9702, 139, 207), mh('KD00118', 'Priyanka Deshmukh', 'Akola', 9544, 136, 198), nat('KD02902', 'Puja Kumari', 'Gaya', 'Bihar', 9420, 133, 194)],
  },
};

/** The Didi's own rank where she is outside the listed top places. */
const MY_RANK: Record<Scope, Record<Period, { rank: number; of: number; score: number; tasks: number; farmers: number }>> = {
  state: { month: { rank: 7, of: 214, score: 812, tasks: 10, farmers: 14 }, all: { rank: 4, of: 214, score: 8870, tasks: 122, farmers: 14 } },
  national: { month: { rank: 43, of: 1860, score: 812, tasks: 10, farmers: 14 }, all: { rank: 31, of: 1860, score: 8870, tasks: 122, farmers: 14 } },
};

export function board(scope: Scope, period: Period) {
  const list = BOARDS[scope][period].map((l, i) => ({ ...l, rank: i + 1 }));
  const mine = MY_RANK[scope][period];
  return { list, me: { ...ME, ...mine } };
}
