'use strict';
const BANDS=['Красная 7–16 кг','Чёрная 11–29 кг','Фиолетовая 16–39 кг','Зелёная 22–57 кг'];
const DN=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const P={
1:{n:'ВЕРХ A',mma:true,note:'Умеренно · RIR 2',ex:[
{id:'bench',n:'Жим от груди лёжа',s:3,min:6,max:10,r:2,rest:150,m:{chest:1,frontDelt:2,triceps:2},h:'Лопатки стабильно, локти примерно 45° к корпусу. Опускай подконтрольно, жми без отрыва корпуса.'},
{id:'vrow',n:'Вертикальная тяга',s:3,min:8,max:12,r:2,rest:120,m:{lats:1,biceps:2,rearDelt:3},h:'Тяни локти вниз к корпусу, не раскачивайся. Внизу сведи лопатки.'},
{id:'shoulder',n:'Жим вверх сидя',s:2,min:8,max:12,r:2,rest:120,m:{frontDelt:1,sideDelt:2,triceps:2},h:'Корпус стабилен. Не прогибай поясницу, веди локти под кистями.'},
{id:'curlmachine',n:'Бицепс сидя',s:2,min:10,max:15,r:2,rest:75,m:{biceps:1,brachialis:2},h:'Плечо фиксировано. Сгибай без рывка и полностью контролируй опускание.'},
{id:'tricepsmachine',n:'Трицепс',s:2,min:10,max:15,r:2,rest:75,m:{triceps:1},h:'Локти фиксированы. Полное контролируемое разгибание без помощи корпусом.'}]},
2:{n:'НИЗ A + CORE',mma:false,note:'Основной тяжёлый день ног · RIR 1–2',ex:[
{id:'squat',n:'Приседание в тренажёре',s:4,min:6,max:10,r:1,rest:180,m:{quads:1,glutes:2,core:3,adductors:2},h:'Колени следуют направлению стоп. Спина нейтральна, глубина без потери контроля.'},
{id:'dead',n:'Становая в Combo Lift',s:3,min:6,max:10,r:1,rest:180,m:{hamstrings:1,glutes:1,erectors:2,lats:3,core:3},h:'Движение начинается тазом. Спина нейтральна, вверху не переразгибай поясницу.'},
{id:'abduct',n:'Отведение бедра',s:2,min:12,max:15,r:2,rest:75,m:{gluteMed:1,glutes:2},h:'Таз не разворачивай. Отводи бедро контролируемо, без инерции.'},
{id:'calfA',n:'Подъём на носки',s:3,min:12,max:20,r:2,rest:75,m:{calves:1},h:'Полная амплитуда: растяжение внизу, пауза наверху.'},
{id:'legraise',n:'Подъём ног',s:3,min:10,max:15,r:2,rest:75,m:{abs:1,core:2},h:'Не раскачивайся. В верхней части слегка подкручивай таз, контролируй опускание.'}]},
3:{n:'ПЛЕЧИ + CORE',mma:true,note:'Лёгкий день · вечером MMA',ex:[
{id:'lateral',n:'Подъём рук в стороны с резинкой',s:3,min:12,max:20,r:2,rest:60,band:true,m:{sideDelt:1,frontDelt:3},h:'Поднимай руки примерно до уровня плеч, без рывка и подъёма плеч к ушам.',v:'https://www.youtube.com/results?search_query=band+lateral+raise+proper+form'},
{id:'facepull',n:'Face Pull с резинкой',s:3,min:12,max:20,r:2,rest:60,band:true,m:{rearDelt:1,traps:2,rhomboids:2,rotator:2},h:'Тяни резинку к лицу, локти высоко, в конце разворачивай кисти назад и своди лопатки.',v:'https://www.youtube.com/watch?v=PYj77in44ms'},
{id:'external',n:'Наружная ротация плеча',s:2,min:15,max:20,r:3,rest:60,band:true,m:{rotator:1,rearDelt:3},h:'Локти прижаты к корпусу и согнуты около 90°. Разводи предплечья наружу без движения плеч.',v:'https://www.youtube.com/watch?v=_UvmPNGtlPM'},
{id:'pallof',n:'Pallof Press',s:3,min:10,max:15,r:2,rest:60,band:true,side:true,m:{obliques:1,core:1,abs:2},h:'Встань боком к точке крепления. Выжми руки вперёд и не позволяй корпусу повернуться.',v:'https://www.youtube.com/watch?v=FuhasegBeP0'},
{id:'plank',n:'Планка',s:2,min:30,max:60,r:2,rest:60,time:true,m:{core:1,abs:1,glutes:3},h:'Тело одной линией. Подкрути таз, напряги ягодицы и живот, не проваливай поясницу.'}]},
4:{n:'ВЕРХ B',mma:false,note:'Основной тяжёлый день верха · RIR 1–2',ex:[
{id:'pullup',n:'Подтягивания',s:3,min:6,max:12,r:1,rest:180,m:{lats:1,biceps:2,brachialis:2,rhomboids:2},h:'Начинай со сведения/опускания лопаток. Не раскачивайся, тяни грудь к перекладине.'},
{id:'row',n:'Тяга к поясу',s:3,min:8,max:12,r:1,rest:150,m:{lats:1,rhomboids:1,traps:2,rearDelt:2,biceps:2},h:'Тяни локти назад, своди лопатки. Не превращай движение в разгибание поясницы.'},
{id:'cheststand',n:'Жим от груди стоя',s:3,min:8,max:12,r:1,rest:150,m:{chest:1,frontDelt:2,triceps:2,core:3},h:'Корпус стабилен, движение от груди вперёд. Не поднимай плечи.'},
{id:'dips',n:'Брусья',s:2,min:6,max:12,r:1,rest:150,m:{chest:1,triceps:1,frontDelt:2},h:'Небольшой наклон вперёд. Опускайся до комфортной глубины без боли в плечах.'},
{id:'lowhigh',n:'Low-to-High Fly с резинкой',s:2,min:12,max:15,r:2,rest:60,band:true,m:{upperChest:1,chest:2,frontDelt:3},h:'Веди руки снизу-вверх по дуге, локти слегка согнуты. Своди руки перед верхом груди.',v:'https://www.youtube.com/watch?v=N0uLm6RT9zg'},
{id:'reardelt',n:'Разведение на заднюю дельту с резинкой',s:2,min:12,max:20,r:2,rest:60,band:true,m:{rearDelt:1,rhomboids:2,traps:3},h:'Руки почти прямые. Разводи в стороны без прогиба поясницы, чувствуй заднюю дельту.',v:'https://www.youtube.com/results?search_query=band+rear+delt+fly+proper+form'},
{id:'hammer',n:'Молотковые сгибания с резинкой',s:2,min:10,max:15,r:2,rest:60,band:true,m:{brachialis:1,biceps:2,forearms:2},h:'Ладони смотрят друг на друга. Локти не уводи вперёд, опускай медленно.',v:'https://www.youtube.com/results?search_query=resistance+band+hammer+curl+proper+form'}]},
5:{n:'НИЗ B',mma:true,note:'Умеренно · вечером MMA · RIR 2',ex:[
{id:'bulgarian',n:'Болгарские приседания',s:3,min:8,max:12,r:2,rest:120,band:true,m:{quads:1,glutes:1,adductors:2,core:3},h:'Передняя стопа полностью на земле. Колено движется по линии стопы, корпус стабилен.',v:'https://www.youtube.com/results?search_query=band+bulgarian+split+squat+proper+form'},
{id:'legcurlband',n:'Сгибание ноги с резинкой',s:3,min:10,max:15,r:2,rest:75,band:true,m:{hamstrings:1,calves:3},h:'Фиксируй бедро. Сгибай колено без движения таза, медленно возвращай.',v:'https://www.youtube.com/results?search_query=resistance+band+leg+curl+proper+form'},
{id:'legpress',n:'Жим ногами',s:2,min:10,max:15,r:2,rest:120,m:{quads:1,glutes:2,hamstrings:3},h:'Стопы устойчиво, колени по линии стоп. Не блокируй колени резко.'},
{id:'bridge',n:'Ягодичный мост с резинкой',s:3,min:10,max:15,r:2,rest:75,band:true,m:{glutes:1,hamstrings:2,core:3},h:'Подкрути таз, толкай пятками. Вверху сожми ягодицы, не переразгибай поясницу.',v:'https://www.youtube.com/results?search_query=resistance+band+glute+bridge+proper+form'},
{id:'calfB',n:'Подъём на носки',s:3,min:15,max:20,r:2,rest:75,m:{calves:1},h:'Полная амплитуда и короткая пауза вверху.'},
{id:'hyper',n:'Гиперэкстензия',s:2,min:12,max:15,r:2,rest:75,m:{erectors:1,glutes:2,hamstrings:2},h:'Двигайся через тазобедренный сустав, спина нейтральна. Не переразгибайся наверху.'}]}
};
const DEFAULT_FOODS=[
{id:'oats',name:'Овсянка',cal:366,p:12.3,f:6.1,c:59.5},
{id:'buck',name:'Гречка варёная',cal:110,p:4.2,f:1.1,c:21.3},
{id:'pasta',name:'Макароны твёрдых сортов варёные',cal:135,p:5,f:1.1,c:27},
{id:'chicken',name:'Куриное бедро готовое',cal:210,p:26,f:11,c:0},
{id:'cottage',name:'Творог 5%',cal:121,p:17,f:5,c:1.8},
{id:'kefir',name:'Кефир',cal:53,p:3,f:2.5,c:4},
{id:'egg',name:'Яйцо куриное',cal:157,p:12.7,f:11.5,c:.7},
{id:'banana',name:'Банан',cal:89,p:1.1,f:.3,c:22.8},
{id:'honey',name:'Мёд',cal:304,p:.3,f:0,c:82.4},
{id:'whey',name:'Сывороточный протеин',cal:390,p:78,f:6,c:7}
];
