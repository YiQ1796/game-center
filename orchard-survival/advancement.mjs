// Original Monkey Sanmao progression design; reference-video mechanics are not verified.
export const ADVANCEMENT_LEVEL = 8;
export const ADVANCEMENTS = Object.freeze({
  staff: Object.freeze([
    {id:'king',name:'金箍戰神',role:'旋風爆發',color:'#f2b247',power:.24,haste:.12,reach:.11,crit:.06,
      description:'金箍棒連擊更快、重擊更遠。適合喜歡衝進怪潮的猴三毛。'},
    {id:'guardian',name:'花果山守護者',role:'生存控場',color:'#7acb9d',health:.36,guard:.14,reach:.19,
      description:'生命大增、減傷並擴張掃擊範圍。適合近戰長時間生存。'}
  ]),
  mage: Object.freeze([
    {id:'storm',name:'紫電靈猴',role:'速攻爆發',color:'#c5a0ff',power:.18,haste:.18,crit:.09,
      description:'法術更密集、暴擊更兇。適合用紫電掃平怪群。'},
    {id:'archmage',name:'香蕉大魔導',role:'遠程控場',color:'#ffbf70',power:.12,reach:.28,health:.17,
      description:'擴大法術覆蓋範圍，還有更高的生存能力。'}
  ]),
  scout: Object.freeze([
    {id:'ranger',name:'疾風神射手',role:'速射暴擊',color:'#79e5b3',haste:.20,crit:.15,power:.08,
      description:'果籽箭連發與高暴擊，精準穿透蜂群。'},
    {id:'shadow',name:'叢林影行者',role:'疾走閃避',color:'#8ad7eb',speed:.21,guard:.10,reach:.12,
      description:'跑得更快、挨打更少，適合拉怪與機動遊走。'}
  ])
});
export function getAdvancement(job,id) {
  return ADVANCEMENTS[job]?.find(item=>item.id===id) || null;
}
