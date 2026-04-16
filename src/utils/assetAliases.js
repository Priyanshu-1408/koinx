export const getStandardAsset = (asset) => {
  if (!asset) return null;
  
  const normalized = String(asset).toUpperCase().trim();
  
  const aliasMap = {
    'BITCOIN': 'BTC',
    'BTC': 'BTC',
    'ETHEREUM': 'ETH',
    'ETH': 'ETH',
    'DOGECOIN': 'DOGE',
    'DOGE': 'DOGE'
  };
  
  return aliasMap[normalized] || normalized;
};
