import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  useTheme, 
  alpha 
} from '@mui/material';
import {
  TextFields,
  Notes,
  Tag,
  AttachMoney,
  Percent,
  CalendarToday,
  Schedule,
  CheckBox,
  List as ListIcon,
  Link,
  AlternateEmail,
  Phone,
  Person,
  Image,
  Code
} from '@mui/icons-material';

interface TypeConfig {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const PROPERTY_TYPES: TypeConfig[] = [
  { value: 'text', label: 'Single Line Text', icon: <TextFields />, description: 'Short text values like names, titles', color: '#2196F3' },
  { value: 'long_text', label: 'Long Text', icon: <Notes />, description: 'Multi-line text areas', color: '#2196F3' },
  { value: 'number', label: 'Number', icon: <Tag />, description: 'Integers or decimals', color: '#4CAF50' },
  { value: 'currency', label: 'Currency', icon: <AttachMoney />, description: 'Monetary values', color: '#4CAF50' },
  { value: 'percentage', label: 'Percentage', icon: <Percent />, description: 'Values from 0-100%', color: '#4CAF50' },
  { value: 'date', label: 'Date', icon: <CalendarToday />, description: 'Calendar date', color: '#9C27B0' },
  { value: 'datetime', label: 'Date & Time', icon: <Schedule />, description: 'Date with time', color: '#9C27B0' },
  { value: 'checkbox', label: 'Checkbox', icon: <CheckBox />, description: 'Boolean true/false', color: '#FF9800' },
  { value: 'choice', label: 'Choice', icon: <ListIcon />, description: 'Select one from a list', color: '#FF9800' },
  { value: 'multi_choice', label: 'Multi Choice', icon: <ListIcon />, description: 'Select multiple from a list', color: '#FF9800' },
  { value: 'url', label: 'URL', icon: <Link />, description: 'Web link', color: '#00BCD4' },
  { value: 'email', label: 'Email', icon: <AlternateEmail />, description: 'Email address', color: '#00BCD4' },
  { value: 'phone', label: 'Phone', icon: <Phone />, description: 'Phone number', color: '#00BCD4' },
  { value: 'reference', label: 'Reference', icon: <Link sx={{ transform: 'rotate(45deg)' }} />, description: 'Link to another record', color: '#795548' },
  { value: 'user', label: 'User', icon: <Person />, description: 'System user', color: '#607D8B' },
  { value: 'attachment', label: 'Attachment', icon: <Image />, description: 'Files and images', color: '#F44336' },
  { value: 'json', label: 'JSON', icon: <Code />, description: 'Raw JSON data', color: '#607D8B' },
];

interface TypeSelectorProps {
  selectedType?: string;
  onSelect: (type: string) => void;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({ selectedType, onSelect }) => {
  const theme = useTheme();

  return (
    <Box display="flex" flexWrap="wrap" gap={2}>
      {PROPERTY_TYPES.map((type) => {
        const isSelected = selectedType === type.value;
        return (
          <Box 
            key={type.value}
            sx={{ 
              width: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.33% - 16px)' } 
            }}
          >
            <Paper
              elevation={0}
              variant="outlined"
              onClick={() => onSelect(type.value)}
              sx={{
                p: 2,
                cursor: 'pointer',
                border: 2,
                borderColor: isSelected ? type.color : 'divider',
                bgcolor: isSelected ? alpha(type.color, 0.05) : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: isSelected ? type.color : 'text.disabled',
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[2]
                }
              }}
            >
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Box 
                  sx={{ 
                    color: type.color,
                    display: 'flex',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(type.color, 0.1)
                  }}
                >
                  {type.icon}
                </Box>
                <Typography variant="subtitle2" fontWeight="bold">
                  {type.label}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {type.description}
              </Typography>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
};
