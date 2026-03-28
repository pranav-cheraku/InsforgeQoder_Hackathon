import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import { ActivityIndicator, View } from 'react-native';
import { Grid3x3, Tag, Clock, User } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WishlistScreen } from './src/screens/WishlistScreen';
import { DealsScreen } from './src/screens/DealsScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { colors, fonts } from './src/theme/colors';
import type { WishlistItem } from './src/data/mockData';

export type WishlistStackParamList = {
  WishlistMain: undefined;
  ItemDetail: { item: WishlistItem };
};

export type DealsStackParamList = {
  DealsMain: undefined;
  ItemDetail: { item: WishlistItem };
};

const WishlistStack = createNativeStackNavigator<WishlistStackParamList>();
const DealsStack = createNativeStackNavigator<DealsStackParamList>();
const Tab = createBottomTabNavigator();

function WishlistStackScreen() {
  return (
    <WishlistStack.Navigator screenOptions={{ headerShown: false }}>
      <WishlistStack.Screen name="WishlistMain" component={WishlistScreen} />
      <WishlistStack.Screen name="ItemDetail" component={ItemDetailScreen} />
    </WishlistStack.Navigator>
  );
}

function DealsStackScreen() {
  return (
    <DealsStack.Navigator screenOptions={{ headerShown: false }}>
      <DealsStack.Screen name="DealsMain" component={DealsScreen} />
      <DealsStack.Screen name="ItemDetail" component={ItemDetailScreen} />
    </DealsStack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 6,
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.mutedForeground,
            tabBarLabelStyle: {
              fontFamily: fonts.sansSemiBold,
              fontSize: 10,
            },
            tabBarIcon: ({ color, focused }) => {
              const strokeWidth = focused ? 2.5 : 1.5;
              if (route.name === 'Wishlist') return <Grid3x3 size={20} color={color} strokeWidth={strokeWidth} />;
              if (route.name === 'Deals') return <Tag size={20} color={color} strokeWidth={strokeWidth} />;
              if (route.name === 'Activity') return <Clock size={20} color={color} strokeWidth={strokeWidth} />;
              if (route.name === 'Profile') return <User size={20} color={color} strokeWidth={strokeWidth} />;
            },
          })}
        >
          <Tab.Screen name="Wishlist" component={WishlistStackScreen} />
          <Tab.Screen name="Deals" component={DealsStackScreen} />
          <Tab.Screen name="Activity" component={ActivityScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
