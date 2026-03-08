import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Calendar, ClipboardList, Home, Package, Settings } from 'lucide-react-native';

const ACTIVE_COLOR = '#6366f1';
const INACTIVE_COLOR = '#64748b';
const TAB_BAR_BG = '#1e293b';

type TabIconProps = {
  focused: boolean;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
};

function TabIcon({ focused, Icon }: TabIconProps) {
  return (
    <View className="items-center justify-center">
      <Icon
        size={22}
        color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
        strokeWidth={focused ? 2.5 : 1.8}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopColor: '#334155',
          borderTopWidth: 1,
          paddingTop: 6,
          height: 64,
        },
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Home} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Calendar} />,
        }}
      />
      <Tabs.Screen
        name="protocols"
        options={{
          title: 'Protocols',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={ClipboardList} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Package} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Settings} />,
        }}
      />
    </Tabs>
  );
}
