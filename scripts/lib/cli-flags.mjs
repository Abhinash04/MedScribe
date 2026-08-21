export const flag = name => {
  const match = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
};
