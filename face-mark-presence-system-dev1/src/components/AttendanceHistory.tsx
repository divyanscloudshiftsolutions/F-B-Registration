import React, { useState } from 'react';
import { Calendar, Clock, MapPin, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { resolveMediaUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { AttendanceRecord } from '@/hooks/useAttendance';
import { cn } from '@/lib/utils';

interface AttendanceHistoryProps {
  records: AttendanceRecord[];
  className?: string;
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ records, className }) => {
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  // Group records by date
  const recordsByDate = records.reduce((acc, record) => {
    const date = record.timestamp.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  // Sort dates in descending order
  const sortedDates = Object.keys(recordsByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  };

  const formatTime = (timestamp: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    };
    return new Date(timestamp).toLocaleTimeString(undefined, options);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      default:
        return null;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'face':
        return <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Face</span>;
      case 'manual':
        return <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-blue-600" /> Manual</span>;
      case 'geolocation':
        return <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-purple-600" /> Geo</span>;
      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {sortedDates.length > 0 ? (
        <div>
          {sortedDates.map(date => (
            <div key={date} className="mb-6">
              <div className="flex items-center mb-2">
                <Calendar className="mr-2 h-4 w-4 text-attendance-primary" />
                <h3 className="font-medium">{formatDate(date)}</h3>
              </div>
              
              <div className="bg-white rounded-md shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsByDate[date].map(record => (
                      <TableRow 
                        key={record.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <TableCell className="font-medium">
                          {formatTime(record.timestamp)}
                        </TableCell>
                        <TableCell>
                          {record.type === 'check-in' ? 'Check In' : 'Check Out'}
                        </TableCell>
                        <TableCell>{getMethodIcon(record.method)}</TableCell>
                        <TableCell className="text-right">
                          {getStatusBadge(record.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="bg-muted/50 inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No attendance records</h3>
          <p className="text-muted-foreground">Your attendance history will appear here</p>
        </div>
      )}

      {/* Record details dialog */}
      <Dialog 
        open={!!selectedRecord} 
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      >
        {selectedRecord && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attendance Record Details</DialogTitle>
              <DialogDescription>
                {new Date(selectedRecord.timestamp).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Type:</span>
                </div>
                <span>
                  {selectedRecord.type === 'check-in' ? 'Check In' : 'Check Out'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Method:</span>
                </div>
                <span className="capitalize">{selectedRecord.method}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Status:</span>
                </div>
                <span>{getStatusBadge(selectedRecord.status)}</span>
              </div>
              
              {selectedRecord.location && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location:</span>
                  </div>
                  <div className="bg-muted p-2 rounded text-xs">
                    <div>Latitude: {selectedRecord.location.latitude.toFixed(6)}</div>
                    <div>Longitude: {selectedRecord.location.longitude.toFixed(6)}</div>
                    <div>Accuracy: {selectedRecord.location.accuracy.toFixed(1)}m</div>
                  </div>
                </div>
              )}
              
              {selectedRecord.note && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Note:</span>
                  </div>
                  <div className="bg-muted p-2 rounded text-sm">
                    {selectedRecord.note}
                  </div>
                </div>
              )}
              
              {selectedRecord.imageUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Image:</span>
                  </div>
                  <img 
                    src={resolveMediaUrl(selectedRecord.imageUrl)} 
                    alt="Attendance verification" 
                    className="w-full h-auto rounded border"
                  />
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => setSelectedRecord(null)}
              className="w-full mt-2"
            >
              Close
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default AttendanceHistory;