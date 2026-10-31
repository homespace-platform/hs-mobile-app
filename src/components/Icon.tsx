import { Ionicons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';

// Resolve semantic text colors into the native icon color prop.
export default cssInterop(Ionicons, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});
