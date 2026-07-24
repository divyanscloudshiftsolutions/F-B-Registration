import React from "react";
import { Search, Calendar, Filter } from "lucide-react";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar as CalendarComponent } from "./ui/calendar";

interface AttendanceFiltersProps {
  onFilterChange: React.Dispatch<
    React.SetStateAction<{
      date: Date | undefined;
      month: Date;
      type: string | undefined;
      method: string | undefined;
      search: string;
    }>
  >;
}

const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  onFilterChange,
}) => {
  const [date, setDate] = React.useState<Date>();
  const [month, setMonth] = React.useState<Date>(new Date());
  const [type, setType] = React.useState<string>();
  const [method, setMethod] = React.useState<string>();
  const [search, setSearch] = React.useState("");

  const handleFilterChange = (
    updates: Partial<{
      date: Date | undefined;
      month: Date;
      type: string | undefined;
      method: string | undefined;
      search: string;
    }>
  ) => {
    onFilterChange((prevFilters) => ({
      ...prevFilters,
      ...updates,
    }));
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records by Employee Name..."
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleFilterChange({ search: e.target.value });
            }}
          />
        </div>
      </div>

      <Select
        value={format(month, "yyyy-MM")}
        onValueChange={(value) => {
          const newMonth = new Date(value + "-01");
          setMonth(newMonth);
          handleFilterChange({ month: newMonth });
        }}
      >
        <SelectTrigger className="min-w-[180px]">
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[240px]">
            <Calendar className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              setDate(newDate);
              handleFilterChange({ date: newDate });
            }}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <Select
        value={type}
        onValueChange={(value) => {
          setType(value);
          handleFilterChange({ type: value });
        }}
      >
        <SelectTrigger className="min-w-[160px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="check-in">Check In</SelectItem>
          <SelectItem value="check-out">Check Out</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={method}
        onValueChange={(value) => {
          setMethod(value);
          handleFilterChange({ method: value });
        }}
      >
        <SelectTrigger className="min-w-[160px]">
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Methods</SelectItem>
          <SelectItem value="face">Face Recognition</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
          <SelectItem value="geolocation">Geolocation</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        onClick={() => {
          setDate(undefined);
          setType(undefined);
          setMethod(undefined);
          setSearch("");
          handleFilterChange({
            date: undefined,
            type: undefined,
            method: undefined,
            search: "",
          });
        }}
      >
        <Filter className="mr-2 h-4 w-4" />
        Clear Filters
      </Button>
    </div>
  );
};

export default AttendanceFilters;
