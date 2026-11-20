export const ADVANCEMENT_LEVEL = 8;
export const ADVANCEMENTS = Object.freeze({
  staff: Object.freeze([
    {id:'king',burst:'三疊震山',technique:'原地重擊，三道金色震波依序向外擴張。',name:'金箍戰神',role:'旋風爆發',color:'#f2b247',power:.24,haste:.12,reach:.11,crit:.06,
      description:'金箍棒連擊更快、重擊更遠。適合喜歡衝進怪潮的猴三毛。'},
    {id:'guardian',burst:'山靈庇護',technique:'擊退近敵，替附近隊友回復生命並短暫抵擋傷害。',name:'花果山守護者',role:'生存控場',color:'#7acb9d',health:.36,guard:.14,reach:.19,
      description:'生命大增、減傷並擴張掃擊範圍。適合近戰長時間生存。'}
  ]),
  mage: Object.freeze([
    {id:'storm',burst:'天雷點名',technique:'對周圍最多六名敵人各降一道紫雷。',name:'紫電靈猴',role:'速攻爆發',color:'#c5a0ff',power:.18,haste:.18,crit:.09,
      description:'法術更密集、暴擊更兇。適合用紫電掃平怪群。'},
    {id:'archmage',burst:'霜火交響',technique:'冰封腳下的怪群，再向鎖定的位置降下隕星。',name:'香蕉大魔導',role:'遠程控場',color:'#ffbf70',power:.12,reach:.28,health:.17,
      description:'擴大法術覆蓋範圍，還有更高的生存能力。'}
  ]),
  scout: Object.freeze([
    {id:'ranger',burst:'穿林箭陣',technique:'朝最近的敵人集中射出九支扇形穿透箭。',name:'疾風神射手',role:'速射暴擊',color:'#79e5b3',haste:.20,crit:.15,power:.08,
      description:'果籽箭連發與高暴擊，精準穿透蜂群。'},
    {id:'shadow',burst:'穿影回射',technique:'沿瞄準方向突進，轉身對鎖定的敵人射出三支穿透箭。',name:'叢林影行者',role:'疾走閃避',color:'#8ad7eb',speed:.21,guard:.10,reach:.12,
      description:'跑得更快、挨打更少，適合拉怪與機動遊走。'}
  ])
});
export function getAdvancement(job,id) {
  return ADVANCEMENTS[job]?.find(item=>item.id===id) || null;
}
