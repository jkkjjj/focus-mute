export const DEFAULT_RULES = {
  version: 1,
  allowVideoIds: [],
  denyVideoIds: [],
  allowChannelIds: [],
  denyChannelIds: [],
  denyPatterns: [],
  entertainmentPatterns: [
    "\\b(music|soundtrack|playlist|lo[ -]?fi|mv|amv|anime edit|gameplay|gaming|walkthrough|let.s play|gossip|prank|vlog|reaction|compilation|highlights|concert|karaoke|remix)\\b",
    "音乐|音樂|歌曲|歌单|歌單|演唱|背景音|白噪音|动漫混剪|動漫混剪|综艺|綜藝|八卦|游戏实况|遊戲實況|搞笑|娱乐|娛樂|追剧|追劇|鬼畜",
  ],
  subjectPatterns: [
    "\\b(computer science|machine learning|deep learning|artificial intelligence|neural networks?|AI|linear algebra|calculus|mathematics|math|statistics|probability|algorithm|data structures?|programming|coding|python|javascript|typescript|rust|java|c\\+\\+|sql|computer vision|reinforcement learning|transformers?|language models?|physics|chemistry|biology|economics|linguistics)\\b",
    "计算机|計算機|人工智能|机器学习|機器學習|深度学习|深度學習|神经网络|神經網絡|数学|數學|微积分|微積分|线性代数|線性代數|概率|機率|统计|統計|编程|編程|算法|演算法|数据结构|資料結構|物理|化学|化學|生物|英语|英語",
    "\\b(English|IELTS|TOEFL|ESL|pronunciation|grammar|vocabulary)\\b",
  ],
  instructionPatterns: [
    "\\b(lectures?|lessons?|tutorials?|courses?|chapter [0-9]+|seminars?|university|proofs?|derive|derivation|theorems?|exercises?|problem sets?|paper review|paper explained|research paper|explained|explanation|teach|teaching|learn|learning|pronunciation|grammar|vocabulary)\\b",
    "课程|課程|讲座|講座|讲解|講解|教学|教學|教程|推导|推導|证明|證明|定理|习题|習題|练习|練習|论文|論文|学术|學術|语法|語法|发音|發音|词汇|詞彙",
  ],
  languageInstructionPatterns: [
    "\\b(English (lesson|teaching|grammar|pronunciation|vocabulary|class|course)|learn English|IELTS|TOEFL|ESL|pronunciation|grammar|vocabulary)\\b",
    "英语教学|英語教學|英语课|英語課|英语发音|英語發音|英语语法|英語語法|英语词汇|英語詞彙",
  ],
};
