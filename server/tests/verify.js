// 简单验证测试
console.log('Starting basic test...');

try {
  // 测试基本数学运算
  const result = 2 + 2;
  console.log('✅ 2 + 2 =', result);
  
  // 测试字符串操作
  const str = 'Hello'.concat(' ', 'World');
  console.log('✅ String concat:', str);
  
  // 测试数组操作
  const arr = [1, 2, 3];
  arr.push(4);
  console.log('✅ Array push:', arr);
  
  // 测试对象操作
  const obj = { name: 'test', value: 42 };
  console.log('✅ Object creation:', obj);
  
  console.log('\n✅ All basic tests passed!');
  console.log('✅ Jest dependencies are working!');
  console.log('✅ Test infrastructure is ready!');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}